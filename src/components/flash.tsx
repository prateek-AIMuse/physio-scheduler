/* Shows the result of the last action, passed back in the URL */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div className="stack-sm" role="status">
      {ok && <p className="notice">{ok}</p>}
      {error && <p className="notice error">{error}</p>}
    </div>
  );
}

export type FlashParams = Promise<{ ok?: string; error?: string }>;
