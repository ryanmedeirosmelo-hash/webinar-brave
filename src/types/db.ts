export type WebinarType = "unico" | "just_in_time";
export type AudienceMode = "fixed" | "dynamic" | "none";

export type FormField = {
  key: "name" | "email" | "whatsapp";
  enabled: boolean;
  required: boolean;
  label: string;
};

export type Webinar = {
  id: string;
  slug: string;
  title: string;
  internal_name: string | null;
  language: string;
  presenter_name: string | null;
  presenter_avatar_url: string | null;
  description: string | null;
  video_url: string;
  video_path: string | null;
  duration_seconds: number;
  available_times: string[];
  timezone: string;
  status: string;
  type: WebinarType;
  jit_interval_minutes: number;
  audience_enabled: boolean;
  audience_mode: AudienceMode;
  audience_base: number;
  // Etapa 2 — datas / recorrência / sala de espera
  start_at: string | null;
  end_at: string | null;
  recurrence_enabled: boolean;
  recurrence_freq: string;
  recurrence_dow: string | null;
  recurrence_days: number[]; // ISO 1=segunda … 7=domingo (fonte da verdade do "quando")
  waiting_room_enabled: boolean;
  waiting_room_page: string;
  // Etapa 3 — login / captura
  logo_url: string | null;
  progress_bar_enabled: boolean;
  progress_start: number;
  progress_bar_color: string;
  progress_text_color: string;
  capture_title: string | null;
  capture_button_label: string;
  capture_button_color: string;
  capture_button_text_color: string;
  capture_image_url: string | null;
  capture_scarcity_text: string | null;
  form_fields: FormField[];
  // Etapa 4 — vídeo
  video_provider: string;
  video_external_url: string | null;
  video_autoplay: boolean;
  video_fullscreen: boolean;
  // Etapa 7 — vendas
  sales_notification_title: string | null;
  // Etapa 8 — audiência
  audience_min: number;
  audience_max: number;
  show_live_button: boolean;
  // Etapa 9 — integrações
  integrations: Record<string, unknown>;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  webinar_id: string;
  at_seconds: number;
  author_name: string;
  message: string;
};

export type Offer = {
  id: string;
  webinar_id: string;
  title: string;
  body: string | null;
  cta_label: string;
  cta_url: string;
  show_at_seconds: number;
  hide_at_seconds: number | null;
  image_url: string | null;
  original_price: number | null;
  offer_price: number | null;
  // Etapa 5 — oferta rica
  name: string | null;
  image_desktop_url: string | null;
  image_mobile_url: string | null;
  button_color: string;
  price_original_text: string | null;
  price_offer_text: string | null;
  pitch_start_seconds: number;
  utm_passthrough: boolean;
  disabled: boolean;
  open_same_window: boolean;
  raffle_enabled: boolean;
};

export type SalesNotification = {
  id: string;
  webinar_id: string;
  at_seconds: number;
  buyer_name: string;
  buyer_city: string | null;
  product_label: string;
};

export type Registration = {
  id: string;
  webinar_id: string;
  name: string;
  email: string;
  phone: string | null;
  scheduled_start_at: string;
  timezone: string;
  access_token: string;
  created_at: string;
};
