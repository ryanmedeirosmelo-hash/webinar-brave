import { ADMIN_ACCENT, ADMIN_LOGO_URL, APP_NAME, wordmarkParts } from "@/lib/brand";

/**
 * Marca do painel (sidebar e login). O logo é opcional e vem de env
 * (`NEXT_PUBLIC_ADMIN_LOGO_URL`) — sem ele fica só o wordmark do nome da
 * instalação (`NEXT_PUBLIC_APP_NAME`).
 */
export function AdminBrand({ logoHeight = "h-16" }: { logoHeight?: string }) {
  const [head, tail] = wordmarkParts(APP_NAME);
  return (
    <>
      {ADMIN_LOGO_URL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ADMIN_LOGO_URL} alt={APP_NAME} className={`${logoHeight} w-auto`} />
      )}
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {head}
        {tail && <span style={{ color: ADMIN_ACCENT }}>{tail}</span>}
      </span>
    </>
  );
}
