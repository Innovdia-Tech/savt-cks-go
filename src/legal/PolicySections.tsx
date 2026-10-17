import { useId, useRef } from "react";
import type { PolicySection } from "./published";

export function PolicySections({
  sections,
}: {
  sections: readonly PolicySection[];
}) {
  const prefix = useId();
  const headings = useRef<Array<HTMLHeadingElement | null>>([]);
  return (
    <>
      <details className="legal-toc">
        <summary>Jump to section</summary>
        <nav aria-label="Policy sections">
          {sections.map((section, index) => (
            <button
              key={section.id}
              type="button"
              className="customer-button"
              onClick={() => {
                const heading = headings.current[index];
                heading?.scrollIntoView({ block: "start" });
                heading?.focus({ preventScroll: true });
              }}
            >
              {section.heading}
            </button>
          ))}
        </nav>
      </details>
      {sections.map((section, index) => (
        <section
          key={section.id}
          className="legal-section"
          aria-labelledby={`${prefix}-${section.id}`}
        >
          <h3
            id={`${prefix}-${section.id}`}
            tabIndex={-1}
            ref={(element) => {
              headings.current[index] = element;
            }}
          >
            {section.heading}
          </h3>
          {section.blocks.map((block, blockIndex) => {
            if (block.type === "paragraph")
              return <p key={blockIndex}>{block.text}</p>;
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={blockIndex}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </List>
            );
          })}
        </section>
      ))}
    </>
  );
}
