export type CountryDialCode = {
  id: string;
  name: string;
  nameEs: string;
  flag: string;
  code: string;
};

/** Países mais usados pelos visitantes do webinar e seus códigos DDI. */
export const COUNTRIES: CountryDialCode[] = [
  { id: "br", name: "Brasil", nameEs: "Brasil", flag: "🇧🇷", code: "+55" },
  { id: "pt", name: "Portugal", nameEs: "Portugal", flag: "🇵🇹", code: "+351" },
  { id: "us", name: "Estados Unidos", nameEs: "Estados Unidos", flag: "🇺🇸", code: "+1" },
  { id: "ca", name: "Canadá", nameEs: "Canadá", flag: "🇨🇦", code: "+1" },
  { id: "es", name: "Espanha", nameEs: "España", flag: "🇪🇸", code: "+34" },
  { id: "gb", name: "Reino Unido", nameEs: "Reino Unido", flag: "🇬🇧", code: "+44" },
  { id: "au", name: "Austrália", nameEs: "Australia", flag: "🇦🇺", code: "+61" },
  { id: "nz", name: "Nova Zelândia", nameEs: "Nueva Zelanda", flag: "🇳🇿", code: "+64" },
  { id: "ar", name: "Argentina", nameEs: "Argentina", flag: "🇦🇷", code: "+54" },
  { id: "cl", name: "Chile", nameEs: "Chile", flag: "🇨🇱", code: "+56" },
  { id: "co", name: "Colômbia", nameEs: "Colombia", flag: "🇨🇴", code: "+57" },
  { id: "pe", name: "Peru", nameEs: "Perú", flag: "🇵🇪", code: "+51" },
  { id: "py", name: "Paraguai", nameEs: "Paraguay", flag: "🇵🇾", code: "+595" },
  { id: "uy", name: "Uruguai", nameEs: "Uruguay", flag: "🇺🇾", code: "+598" },
  { id: "bo", name: "Bolívia", nameEs: "Bolivia", flag: "🇧🇴", code: "+591" },
  { id: "ec", name: "Equador", nameEs: "Ecuador", flag: "🇪🇨", code: "+593" },
  { id: "ve", name: "Venezuela", nameEs: "Venezuela", flag: "🇻🇪", code: "+58" },
  { id: "mx", name: "México", nameEs: "México", flag: "🇲🇽", code: "+52" },
  { id: "cr", name: "Costa Rica", nameEs: "Costa Rica", flag: "🇨🇷", code: "+506" },
  { id: "pa", name: "Panamá", nameEs: "Panamá", flag: "🇵🇦", code: "+507" },
  { id: "gt", name: "Guatemala", nameEs: "Guatemala", flag: "🇬🇹", code: "+502" },
  { id: "hn", name: "Honduras", nameEs: "Honduras", flag: "🇭🇳", code: "+504" },
  { id: "sv", name: "El Salvador", nameEs: "El Salvador", flag: "🇸🇻", code: "+503" },
  { id: "ni", name: "Nicarágua", nameEs: "Nicaragua", flag: "🇳🇮", code: "+505" },
  { id: "do", name: "República Dominicana", nameEs: "República Dominicana", flag: "🇩🇴", code: "+1" },
  { id: "pr", name: "Porto Rico", nameEs: "Puerto Rico", flag: "🇵🇷", code: "+1" },
  { id: "de", name: "Alemanha", nameEs: "Alemania", flag: "🇩🇪", code: "+49" },
  { id: "fr", name: "França", nameEs: "Francia", flag: "🇫🇷", code: "+33" },
  { id: "it", name: "Itália", nameEs: "Italia", flag: "🇮🇹", code: "+39" },
  { id: "ie", name: "Irlanda", nameEs: "Irlanda", flag: "🇮🇪", code: "+353" },
  { id: "nl", name: "Países Baixos", nameEs: "Países Bajos", flag: "🇳🇱", code: "+31" },
  { id: "be", name: "Bélgica", nameEs: "Bélgica", flag: "🇧🇪", code: "+32" },
  { id: "ch", name: "Suíça", nameEs: "Suiza", flag: "🇨🇭", code: "+41" },
  { id: "at", name: "Áustria", nameEs: "Austria", flag: "🇦🇹", code: "+43" },
  { id: "se", name: "Suécia", nameEs: "Suecia", flag: "🇸🇪", code: "+46" },
  { id: "no", name: "Noruega", nameEs: "Noruega", flag: "🇳🇴", code: "+47" },
  { id: "dk", name: "Dinamarca", nameEs: "Dinamarca", flag: "🇩🇰", code: "+45" },
  { id: "fi", name: "Finlândia", nameEs: "Finlandia", flag: "🇫🇮", code: "+358" },
  { id: "pl", name: "Polônia", nameEs: "Polonia", flag: "🇵🇱", code: "+48" },
  { id: "cz", name: "República Tcheca", nameEs: "Chequia", flag: "🇨🇿", code: "+420" },
  { id: "ro", name: "Romênia", nameEs: "Rumanía", flag: "🇷🇴", code: "+40" },
  { id: "ua", name: "Ucrânia", nameEs: "Ucrania", flag: "🇺🇦", code: "+380" },
  { id: "ru", name: "Rússia", nameEs: "Rusia", flag: "🇷🇺", code: "+7" },
  { id: "gr", name: "Grécia", nameEs: "Grecia", flag: "🇬🇷", code: "+30" },
  { id: "tr", name: "Turquia", nameEs: "Turquía", flag: "🇹🇷", code: "+90" },
  { id: "ao", name: "Angola", nameEs: "Angola", flag: "🇦🇴", code: "+244" },
  { id: "mz", name: "Moçambique", nameEs: "Mozambique", flag: "🇲🇿", code: "+258" },
  { id: "cv", name: "Cabo Verde", nameEs: "Cabo Verde", flag: "🇨🇻", code: "+238" },
  { id: "za", name: "África do Sul", nameEs: "Sudáfrica", flag: "🇿🇦", code: "+27" },
  { id: "ng", name: "Nigéria", nameEs: "Nigeria", flag: "🇳🇬", code: "+234" },
  { id: "eg", name: "Egito", nameEs: "Egipto", flag: "🇪🇬", code: "+20" },
  { id: "ma", name: "Marrocos", nameEs: "Marruecos", flag: "🇲🇦", code: "+212" },
  { id: "jp", name: "Japão", nameEs: "Japón", flag: "🇯🇵", code: "+81" },
  { id: "kr", name: "Coreia do Sul", nameEs: "Corea del Sur", flag: "🇰🇷", code: "+82" },
  { id: "cn", name: "China", nameEs: "China", flag: "🇨🇳", code: "+86" },
  { id: "in", name: "Índia", nameEs: "India", flag: "🇮🇳", code: "+91" },
  { id: "il", name: "Israel", nameEs: "Israel", flag: "🇮🇱", code: "+972" },
  { id: "ae", name: "Emirados Árabes Unidos", nameEs: "Emiratos Árabes Unidos", flag: "🇦🇪", code: "+971" },
  { id: "sa", name: "Arábia Saudita", nameEs: "Arabia Saudita", flag: "🇸🇦", code: "+966" },
  { id: "sg", name: "Singapura", nameEs: "Singapur", flag: "🇸🇬", code: "+65" },
  { id: "th", name: "Tailândia", nameEs: "Tailandia", flag: "🇹🇭", code: "+66" },
  { id: "id", name: "Indonésia", nameEs: "Indonesia", flag: "🇮🇩", code: "+62" },
  { id: "my", name: "Malásia", nameEs: "Malasia", flag: "🇲🇾", code: "+60" },
  { id: "ph", name: "Filipinas", nameEs: "Filipinas", flag: "🇵🇭", code: "+63" },
  { id: "vn", name: "Vietnã", nameEs: "Vietnam", flag: "🇻🇳", code: "+84" },
];

/** DDIs únicos, usados para interpretar o telefone no webhook. */
export const COUNTRY_DIAL_CODES = [...new Set(COUNTRIES.map((country) => country.code.slice(1)))].sort(
  (a, b) => b.length - a.length
);
