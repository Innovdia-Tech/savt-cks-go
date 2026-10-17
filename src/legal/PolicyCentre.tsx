import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { syncDialog } from "../components/ui";
import { useDeliveryBack } from "../customer/delivery-back";
import {
  POLICY_KINDS,
  POLICY_TITLES,
  parsePublishedPolicies,
  type PolicyGateway,
  type PolicyKind,
  type PublishedPolicy,
} from "./contracts";
import { usePolicyPreview, type DraftPolicy } from "./preview-context";
import { usePublishedPolicyGateway } from "./published-context";
import {
  parsePublishedPolicyEnvelope,
  type PublishedPolicyDocument,
  type PublishedPolicyGateway,
} from "./published";
import { PolicySections } from "./PolicySections";
import "./legal.css";

type ReadablePolicy = PublishedPolicy | PublishedPolicyDocument;
const policyKind = (policy: ReadablePolicy) =>
  "slug" in policy ? policy.slug : policy.kind;
type PolicyRead = {
  phase: "loading" | "error" | "ready";
  policies: ReadablePolicy[];
};

type PolicyCentreProps = {
  gateway?: PolicyGateway;
  /** A checkout requirement's exact published versions take precedence over a list read. */
  policies?: readonly PublishedPolicy[];
  initialPolicy?: PolicyKind;
  onClose: () => void;
  returnLabel?: string;
  /** Used when a background requirement replaces the original entry button. */
  fallbackFocus?: RefObject<HTMLElement | null>;
};

const policyDate = new Intl.DateTimeFormat("en-MY", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

function PolicyReader({ policy }: { policy: PublishedPolicy }) {
  return (
    <article className="legal-reader">
      <div className="customer-card legal-metadata">
        <dl>
          <div>
            <dt>Version</dt>
            <dd>{policy.version}</dd>
          </div>
          <div>
            <dt>Effective</dt>
            <dd>
              <time dateTime={policy.effectiveAt}>
                {policyDate.format(new Date(policy.effectiveAt))}
              </time>
            </dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>
              <time dateTime={policy.publishedAt}>
                {policyDate.format(new Date(policy.publishedAt))}
              </time>
            </dd>
          </div>
        </dl>
        <p className="legal-timezone">Malaysia time (MYT)</p>
      </div>
      <div className="legal-content">{policy.content}</div>
    </article>
  );
}

function DraftPolicyReader({ policy }: { policy: DraftPolicy }) {
  return (
    <article className="legal-reader legal-reader--draft">
      <div className="legal-reader-overview">
        <p className="legal-reader-subtitle">{policy.subtitle}</p>
        <span className="legal-read-time">{policy.time}</span>
      </div>
      <PolicySections
        sections={policy.sections.map((section, index) => ({
          id: `section-${index + 1}`,
          heading: section.heading,
          blocks: section.paragraphs.map((text) => ({
            type: "paragraph",
            text,
          })),
        }))}
      />
    </article>
  );
}

function PublishedDocumentReader({
  policy,
}: {
  policy: PublishedPolicyDocument;
}) {
  return (
    <article className="legal-reader">
      <div className="legal-reader-overview">
        <p className="legal-reader-subtitle">
          Effective{" "}
          <time dateTime={policy.effectiveAt}>
            {policyDate.format(new Date(policy.effectiveAt))}
          </time>{" "}
          (MYT)
        </p>
        <span className="legal-read-time">Version {policy.version}</span>
      </div>
      <PolicySections sections={policy.sections} />
    </article>
  );
}

export function PolicyCentre({
  gateway,
  policies,
  initialPolicy,
  onClose,
  returnLabel,
  fallbackFocus,
}: PolicyCentreProps) {
  const preview = usePolicyPreview();
  const publishedGateway = usePublishedPolicyGateway();
  const source = gateway ?? publishedGateway;
  const [selected, setSelected] = useState<PolicyKind | null>(
    initialPolicy ?? null,
  );
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<
    PolicyRead & { gateway?: PolicyGateway | PublishedPolicyGateway }
  >(() => ({
    gateway: source,
    phase: source ? "loading" : "ready",
    policies: [],
  }));
  const supplied = useMemo<PolicyRead | undefined>(() => {
    if (policies === undefined) return undefined;
    try {
      return { phase: "ready", policies: parsePublishedPolicies(policies) };
    } catch {
      return { phase: "error", policies: [] };
    }
  }, [policies]);
  const read: PolicyRead =
    supplied ??
    (loaded.gateway === source
      ? loaded
      : {
          phase: source ? "loading" : "ready",
          policies: [],
        });
  // Existing authorized preview fixtures are view-only. They cannot replace a
  // publication, explicit checkout version set, pending read or failed request.
  const draftPolicies =
    !gateway && policies === undefined && read.phase === "ready"
      ? preview?.policies.filter(
          (draft) =>
            !read.policies.some((policy) => policyKind(policy) === draft.kind),
        )
      : undefined;
  const selectedPolicy =
    read.phase === "ready"
      ? read.policies.find((policy) => policyKind(policy) === selected)
      : undefined;
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const policyButtons = useRef<
    Partial<Record<PolicyKind, HTMLButtonElement | null>>
  >({});
  const lastPolicy = useRef<PolicyKind | null>(null);
  const titleId = useId();
  const selectedDraft = draftPolicies?.find(
    (policy) => policy.kind === selected,
  );
  const heading = selected
    ? selectedPolicy && "title" in selectedPolicy
      ? selectedPolicy.title
      : (selectedDraft?.title ?? POLICY_TITLES[selected])
    : "Legal & Policies";

  const back = () => {
    if (selected) setSelected(null);
    else onClose();
    return true;
  };
  useDeliveryBack(back, true, true, selected);

  useEffect(() => {
    if (supplied || !source) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => {
      if (active) {
        controller.abort();
        setLoaded({ gateway: source, phase: "error", policies: [] });
      }
    }, 15_000);
    setLoaded({ gateway: source, phase: "loading", policies: [] });
    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted)
          return source.listPublished(controller.signal);
      })
      .then((value) => {
        if (!active || controller.signal.aborted) return;
        clearTimeout(timeout);
        const published = gateway
          ? parsePublishedPolicies(value)
          : parsePublishedPolicyEnvelope({ data: value });
        setLoaded({ gateway: source, phase: "ready", policies: published });
      })
      .catch(() => {
        clearTimeout(timeout);
        if (active && !controller.signal.aborted) {
          setLoaded({ gateway: source, phase: "error", policies: [] });
        }
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [gateway, source, retry, supplied]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const scrollOwners = [
      document.documentElement,
      document.body,
      ...document.querySelectorAll<HTMLElement>(".app-shell__scroll"),
    ];
    const priorOverflow = scrollOwners.map((owner) => owner.style.overflow);
    syncDialog(element, true);
    scrollOwners.forEach((owner) => {
      owner.style.overflow = "hidden";
    });
    title.current?.focus({ preventScroll: true });
    return () => {
      syncDialog(element, false);
      scrollOwners.forEach((owner, index) => {
        owner.style.overflow = priorOverflow[index];
      });
      const target = returnFocus?.isConnected
        ? returnFocus
        : fallbackFocus?.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);

  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    const previousButton = lastPolicy.current
      ? policyButtons.current[lastPolicy.current]
      : null;
    if (!selected && previousButton?.isConnected) {
      previousButton.focus({ preventScroll: true });
    } else {
      title.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  return (
    <dialog
      ref={dialog}
      className={`legal-dialog${selected ? " legal-dialog--reader" : ""}`}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        back();
      }}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
    >
      <header className="legal-header">
        {selected && (
          <button
            type="button"
            className="customer-button legal-back"
            aria-label="Back to Legal & Policies"
            onClick={back}
          >
            <span aria-hidden="true">‹</span>
          </button>
        )}
        <h2 id={titleId} ref={title} tabIndex={-1}>
          {heading}
        </h2>
        <button
          type="button"
          className="customer-button legal-close"
          aria-label="Close Legal & Policies"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div
        ref={body}
        className="legal-body"
        aria-busy={read.phase === "loading" || undefined}
      >
        {read.phase === "loading" && (
          <p role="status" className="legal-feedback">
            Loading policies…
          </p>
        )}
        {read.phase === "error" && (
          <div role="alert" className="customer-card legal-feedback">
            <p>We couldn't load the policies.</p>
            {source && !supplied && (
              <button
                type="button"
                className="customer-button"
                onClick={() => {
                  setLoaded({
                    gateway: source,
                    phase: "loading",
                    policies: [],
                  });
                  setRetry((attempt) => attempt + 1);
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!selected && draftPolicies && (
          <div className="legal-hub-intro">
            <p>Shopping, delivery, refunds and privacy—explained clearly.</p>
          </div>
        )}

        {!selected &&
          !draftPolicies &&
          read.phase === "ready" &&
          read.policies.length === 0 && (
            <p className="legal-feedback" role="status">
              Policies will appear here when available.
            </p>
          )}

        {selected ? (
          selectedDraft ? (
            <DraftPolicyReader
              key={selectedDraft.kind}
              policy={selectedDraft}
            />
          ) : selectedPolicy ? (
            "slug" in selectedPolicy ? (
              <PublishedDocumentReader
                key={`${selectedPolicy.slug}-${selectedPolicy.version}`}
                policy={selectedPolicy}
              />
            ) : (
              <PolicyReader policy={selectedPolicy} />
            )
          ) : (
            read.phase === "ready" && (
              <div className="customer-card legal-empty">
                <p>Not available yet</p>
              </div>
            )
          )
        ) : (
          <ul className="legal-policy-list">
            {POLICY_KINDS.map((kind) => {
              const draft = draftPolicies?.find((entry) => entry.kind === kind);
              const policy =
                read.phase === "ready"
                  ? read.policies.find((entry) => policyKind(entry) === kind)
                  : undefined;
              return (
                <li key={kind}>
                  <button
                    ref={(element) => {
                      policyButtons.current[kind] = element;
                    }}
                    type="button"
                    className="customer-button legal-policy-row"
                    disabled={!policy && !draft}
                    onClick={() => {
                      lastPolicy.current = kind;
                      setSelected(kind);
                    }}
                  >
                    <span>
                      <span className="legal-policy-title">
                        {policy && "title" in policy
                          ? policy.title
                          : (draft?.title ?? POLICY_TITLES[kind])}
                      </span>
                      <span className="legal-policy-state">
                        {draft
                          ? draft.subtitle
                          : policy
                            ? `Version ${policy.version}`
                            : read.phase === "ready"
                              ? "Not available yet"
                              : read.phase === "loading"
                                ? "Checking availability…"
                                : "Unavailable"}
                      </span>
                    </span>
                    {(policy || draft) && (
                      <span className="legal-chevron" aria-hidden="true">
                        ›
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {returnLabel && (
        <footer className="legal-footer">
          <button type="button" className="customer-button" onClick={onClose}>
            {returnLabel}
          </button>
        </footer>
      )}
    </dialog>
  );
}

export function PolicyEntry({
  open,
  onOpen,
  label = "Legal & Policies",
}: {
  open: boolean;
  onOpen: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="customer-button legal-entry"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
    >
      {label}
      <span aria-hidden="true">›</span>
    </button>
  );
}

export function PolicyLink({
  gateway,
  label = "Legal & Policies",
  returnLabel,
}: {
  gateway?: PolicyGateway;
  label?: string;
  returnLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PolicyEntry open={open} onOpen={() => setOpen(true)} label={label} />
      {open && (
        <PolicyCentre
          gateway={gateway}
          returnLabel={returnLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
