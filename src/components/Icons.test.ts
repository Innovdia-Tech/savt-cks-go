import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CheckIcon, ChevronDownIcon, ClockIcon, TrashIcon } from "./Icons";

it.each([CheckIcon, ChevronDownIcon, ClockIcon, TrashIcon])(
  "%s keeps checkout icon meaning in its adjacent accessible text",
  (Icon) => {
    const html = renderToStaticMarkup(createElement(Icon));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('fill="none"');
    expect(html).not.toContain("<title");
    expect(html).not.toContain("tabindex");
  },
);
