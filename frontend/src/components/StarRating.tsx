import { useState } from "react";

const STAR_PATH =
  "M12 2.5l2.9 6.06 6.6.79-4.86 4.6 1.28 6.55L12 17.3l-5.92 3.2 1.28-6.55-4.86-4.6 6.6-.79z";

/** Uma estrela cujo preenchimento vai de 0 a 1 (permite meia estrela). */
function Star({ fill, size }: { fill: number; size: number }) {
  const clampedFill = Math.max(0, Math.min(1, fill));
  const gradientId = `star-fill-${Math.round(clampedFill * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="star" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="100%" y1="0" y2="0">
          <stop offset={`${clampedFill * 100}%`} stopColor="var(--color-accent)" />
          <stop offset={`${clampedFill * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={STAR_PATH} fill="var(--color-star-empty)" />
      <path d={STAR_PATH} fill={`url(#${gradientId})`} />
    </svg>
  );
}

/** Exibição somente leitura da nota média (0 a 5, aceita fração). */
export function StarRatingDisplay({
  value,
  size = 16,
  showValue = true,
}: {
  value: number | null;
  size?: number;
  showValue?: boolean;
}) {
  if (value === null) {
    return <span className="star-rating star-rating--empty">Sem avaliações ainda</span>;
  }
  return (
    <span className="star-rating" role="img" aria-label={`Nota média: ${value} de 5 estrelas`}>
      <span className="star-rating__stars">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} fill={Math.max(0, Math.min(1, value - i))} />
        ))}
      </span>
      {showValue && <span className="star-rating__value">{value.toFixed(1)}</span>}
    </span>
  );
}

/** Seletor de nota interativo (1 a 5, com meia estrela), usado no formulário de avaliação. */
export function StarRatingInput({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const displayed = hover ?? value;

  function handleClick(event: React.MouseEvent<HTMLButtonElement>, starIndex: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    onChange(isLeftHalf ? starIndex - 0.5 : starIndex);
  }

  function handleMove(event: React.MouseEvent<HTMLButtonElement>, starIndex: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    setHover(isLeftHalf ? starIndex - 0.5 : starIndex);
  }

  return (
    <span className="star-rating star-rating--input" onMouseLeave={() => setHover(null)}>
      <span className="star-rating__stars">
        {[1, 2, 3, 4, 5].map((starIndex) => (
          <button
            key={starIndex}
            type="button"
            className="star-rating__button"
            onMouseMove={(e) => handleMove(e, starIndex)}
            onClick={(e) => handleClick(e, starIndex)}
            aria-label={`${starIndex} estrelas`}
          >
            <Star size={size} fill={Math.max(0, Math.min(1, displayed - (starIndex - 1)))} />
          </button>
        ))}
      </span>
      <span className="star-rating__value">{displayed.toFixed(1)} / 5</span>
    </span>
  );
}
