export type CountryDialCode = {
  id: string;
  name: string;
  flag: string;
  code: string;
};

/** Países mais usados pelos visitantes do webinar e seus códigos DDI. */
export const COUNTRIES: CountryDialCode[] = [
  { id: "br", name: "Brasil", flag: "🇧🇷", code: "+55" },
  { id: "pt", name: "Portugal", flag: "🇵🇹", code: "+351" },
  { id: "us", name: "Estados Unidos", flag: "🇺🇸", code: "+1" },
  { id: "ca", name: "Canadá", flag: "🇨🇦", code: "+1" },
  { id: "es", name: "Espanha", flag: "🇪🇸", code: "+34" },
  { id: "gb", name: "Reino Unido", flag: "🇬🇧", code: "+44" },
  { id: "au", name: "Austrália", flag: "🇦🇺", code: "+61" },
  { id: "nz", name: "Nova Zelândia", flag: "🇳🇿", code: "+64" },
  { id: "ar", name: "Argentina", flag: "🇦🇷", code: "+54" },
  { id: "cl", name: "Chile", flag: "🇨🇱", code: "+56" },
  { id: "co", name: "Colômbia", flag: "🇨🇴", code: "+57" },
  { id: "pe", name: "Peru", flag: "🇵🇪", code: "+51" },
  { id: "py", name: "Paraguai", flag: "🇵🇾", code: "+595" },
  { id: "uy", name: "Uruguai", flag: "🇺🇾", code: "+598" },
  { id: "bo", name: "Bolívia", flag: "🇧🇴", code: "+591" },
  { id: "ec", name: "Equador", flag: "🇪🇨", code: "+593" },
  { id: "ve", name: "Venezuela", flag: "🇻🇪", code: "+58" },
  { id: "mx", name: "México", flag: "🇲🇽", code: "+52" },
  { id: "cr", name: "Costa Rica", flag: "🇨🇷", code: "+506" },
  { id: "pa", name: "Panamá", flag: "🇵🇦", code: "+507" },
  { id: "gt", name: "Guatemala", flag: "🇬🇹", code: "+502" },
  { id: "do", name: "República Dominicana", flag: "🇩🇴", code: "+1" },
  { id: "de", name: "Alemanha", flag: "🇩🇪", code: "+49" },
  { id: "fr", name: "França", flag: "🇫🇷", code: "+33" },
  { id: "it", name: "Itália", flag: "🇮🇹", code: "+39" },
  { id: "ie", name: "Irlanda", flag: "🇮🇪", code: "+353" },
  { id: "nl", name: "Países Baixos", flag: "🇳🇱", code: "+31" },
  { id: "be", name: "Bélgica", flag: "🇧🇪", code: "+32" },
  { id: "ch", name: "Suíça", flag: "🇨🇭", code: "+41" },
  { id: "at", name: "Áustria", flag: "🇦🇹", code: "+43" },
  { id: "se", name: "Suécia", flag: "🇸🇪", code: "+46" },
  { id: "no", name: "Noruega", flag: "🇳🇴", code: "+47" },
  { id: "dk", name: "Dinamarca", flag: "🇩🇰", code: "+45" },
  { id: "fi", name: "Finlândia", flag: "🇫🇮", code: "+358" },
  { id: "pl", name: "Polônia", flag: "🇵🇱", code: "+48" },
  { id: "cz", name: "República Tcheca", flag: "🇨🇿", code: "+420" },
  { id: "ro", name: "Romênia", flag: "🇷🇴", code: "+40" },
  { id: "ua", name: "Ucrânia", flag: "🇺🇦", code: "+380" },
  { id: "ru", name: "Rússia", flag: "🇷🇺", code: "+7" },
  { id: "gr", name: "Grécia", flag: "🇬🇷", code: "+30" },
  { id: "tr", name: "Turquia", flag: "🇹🇷", code: "+90" },
  { id: "ao", name: "Angola", flag: "🇦🇴", code: "+244" },
  { id: "mz", name: "Moçambique", flag: "🇲🇿", code: "+258" },
  { id: "cv", name: "Cabo Verde", flag: "🇨🇻", code: "+238" },
  { id: "za", name: "África do Sul", flag: "🇿🇦", code: "+27" },
  { id: "ng", name: "Nigéria", flag: "🇳🇬", code: "+234" },
  { id: "eg", name: "Egito", flag: "🇪🇬", code: "+20" },
  { id: "ma", name: "Marrocos", flag: "🇲🇦", code: "+212" },
  { id: "jp", name: "Japão", flag: "🇯🇵", code: "+81" },
  { id: "kr", name: "Coreia do Sul", flag: "🇰🇷", code: "+82" },
  { id: "cn", name: "China", flag: "🇨🇳", code: "+86" },
  { id: "in", name: "Índia", flag: "🇮🇳", code: "+91" },
  { id: "il", name: "Israel", flag: "🇮🇱", code: "+972" },
  { id: "ae", name: "Emirados Árabes Unidos", flag: "🇦🇪", code: "+971" },
  { id: "sa", name: "Arábia Saudita", flag: "🇸🇦", code: "+966" },
  { id: "sg", name: "Singapura", flag: "🇸🇬", code: "+65" },
  { id: "th", name: "Tailândia", flag: "🇹🇭", code: "+66" },
  { id: "id", name: "Indonésia", flag: "🇮🇩", code: "+62" },
  { id: "my", name: "Malásia", flag: "🇲🇾", code: "+60" },
  { id: "ph", name: "Filipinas", flag: "🇵🇭", code: "+63" },
  { id: "vn", name: "Vietnã", flag: "🇻🇳", code: "+84" },
];

/** DDIs únicos, usados para interpretar o telefone no webhook. */
export const COUNTRY_DIAL_CODES = [...new Set(COUNTRIES.map((country) => country.code.slice(1)))].sort(
  (a, b) => b.length - a.length
);
