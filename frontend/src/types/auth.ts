export type WidgetPosition = 'left' | 'right'

// One entry per weekday, Monday first. Times are 24h "HH:MM" in the org's timezone.
export interface BusinessHoursDay {
  enabled: boolean
  start: string
  end: string
}

export type FieldRequirement = 'hidden' | 'optional' | 'required'

// A custom question visitors answer before the chat starts.
export interface PreChatField {
  id: string
  label: string
  type: 'text' | 'select'
  options: string[]
  required: boolean
}

export interface Organization {
  name: string
  widget_key: string
  invite_token: string
  widget_color: string
  widget_greeting: string
  widget_position: WidgetPosition
  widget_icon_url: string | null
  widget_width: number
  widget_height: number
  widget_offset_x: number
  widget_offset_y: number
  business_hours_enabled: boolean
  business_hours_timezone: string
  business_hours: BusinessHoursDay[]
  away_message: string
  pre_chat_name: FieldRequirement
  pre_chat_email: FieldRequirement
  pre_chat_fields: PreChatField[]
  auto_assign: boolean
  first_response_minutes: number | null
  typing_preview: boolean
  welcome_messages: string[]
  quick_replies: string[]
  proactive_messages: ProactiveMessage[]
  widget_devices: WidgetDevices
  widget_hidden_paths: string[]
  widget_allowed_domains: string[]
}

export type WidgetDevices = 'all' | 'desktop' | 'mobile'

// An invitation the widget pops up on its own.
export interface ProactiveMessage {
  // Missing until the message is first saved.
  id?: string
  message: string
  // Only on pages whose address contains this; empty means every page.
  page_contains: string
  delay_seconds: number
  // From the visitor's nth visit on.
  min_visits: number
  frequency: 'once' | 'every_visit'
  enabled: boolean
}

export type UserRole = 'admin' | 'agent'

export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_verified: boolean
  role: UserRole
  created_at: string
  organization: Organization
}

export interface Member {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  org_name: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface Teammate {
  id: string
  full_name: string
}
