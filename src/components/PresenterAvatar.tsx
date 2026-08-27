import Image from "next/image";

/**
 * Foto de quem apresenta, vinda do próprio webinar (`presenter_avatar_url`).
 * Nenhuma imagem de cliente mora no repositório: sem URL, quem chama cai no
 * avatar de inicial (ver `HwAvatar`). O círculo é só enquadramento por CSS.
 */
export function PresenterAvatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src: string;
  size?: number;
}) {
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full border border-[#e5e5e5] bg-[#f2f2f2]"
      style={{ width: size, height: size }}
    >
      {/* `unoptimized`: a foto costuma vir do Storage/URL externa do cliente. */}
      <Image src={src} alt={name} fill sizes={`${size}px`} className="object-cover" unoptimized />
    </span>
  );
}
