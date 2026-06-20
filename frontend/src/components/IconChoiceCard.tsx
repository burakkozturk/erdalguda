import { ReactNode } from 'react';

export interface IconChoiceOption<T extends string | number> {
  value: T;
  label: string;
  iconSrc?: string;
  /** Optional fallback rendered when iconSrc is missing or fails to load. */
  fallback?: ReactNode;
}

interface IconChoiceCardProps<T extends string | number> {
  option: IconChoiceOption<T>;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Single premium-style icon choice card. Used inside IconChoiceGrid below.
 * Renders a fixed-size icon frame with a label underneath; active state is
 * marked by gold accent border + glow + tinted background. Visual rendering
 * logic in each configurator stays untouched — this is purely an input UI.
 */
export function IconChoiceCard<T extends string | number>({
  option,
  active,
  disabled,
  onClick,
}: IconChoiceCardProps<T>) {
  return (
    <button
      type="button"
      className={active ? 'icon-choice-card active' : 'icon-choice-card'}
      onClick={onClick}
      disabled={disabled}
      title={option.label}
    >
      <span className="icon-choice-card-frame">
        {option.iconSrc ? (
          <img
            src={option.iconSrc}
            alt=""
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          option.fallback ?? <span className="icon-choice-card-placeholder">{option.label.slice(0, 2)}</span>
        )}
      </span>
      <span className="icon-choice-card-label">{option.label}</span>
    </button>
  );
}

interface IconChoiceGroupProps<T extends string | number> {
  label: string;
  value: T;
  options: IconChoiceOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * Labeled grid of IconChoiceCard. Drop-in replacement for the old
 * `<div className="jc-optionGroup">` blocks — visual layer composition is
 * unchanged because every onChange just sets the same state key as before.
 */
export function IconChoiceGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: IconChoiceGroupProps<T>) {
  return (
    <div className="icon-choice-group">
      <span className="icon-choice-group-label">{label}</span>
      <div className="icon-choice-grid">
        {options.map((option) => (
          <IconChoiceCard
            key={String(option.value)}
            option={option}
            active={option.value === value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
