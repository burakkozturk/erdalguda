import { useState, type ReactNode } from 'react';
import './ConfiguratorAccordion.css';

export interface AccordionSection {
  key: string;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface ConfiguratorAccordionProps {
  sections: AccordionSection[];
  defaultOpenKey?: string;
}

export function ConfiguratorAccordion({
  sections,
  defaultOpenKey,
}: ConfiguratorAccordionProps) {
  const [openKey, setOpenKey] = useState<string | null>(
    defaultOpenKey ?? sections[0]?.key ?? null,
  );

  return (
    <div className="cfg-accordion">
      {sections.map((section) => {
        const isOpen = openKey === section.key;
        return (
          <div
            key={section.key}
            className={`cfg-accordionItem${isOpen ? ' open' : ''}`}
          >
            <button
              type="button"
              className="cfg-accordionHeader"
              aria-expanded={isOpen}
              onClick={() => setOpenKey(isOpen ? null : section.key)}
            >
              <span className="cfg-accordionTitle">
                {section.icon ? (
                  <span className="cfg-accordionIcon" aria-hidden>
                    {section.icon}
                  </span>
                ) : null}
                <span>{section.title}</span>
              </span>
              <span className="cfg-accordionChevron" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div className="cfg-accordionContent">{section.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
