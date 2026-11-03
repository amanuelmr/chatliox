import client from './client'
import type {
  BusinessHoursDay,
  FieldRequirement,
  Member,
  Organization,
  PreChatField,
  ProactiveMessage,
  Teammate,
  UserRole,
  WidgetDevices,
  WidgetLauncher,
  WidgetPosition,
} from '@/types/auth'

export interface WidgetConfig {
  name: string
  widget_color: string
  widget_greeting: string
  widget_position: WidgetPosition
  widget_icon_url: string | null
  widget_width: number
  widget_height: number
  widget_offset_x: number
  widget_offset_y: number
  business_hours_enabled: boolean
  away_message: string
  pre_chat_name: FieldRequirement
  pre_chat_email: FieldRequirement
  pre_chat_fields: PreChatField[]
  first_response_minutes: number | null
  typing_preview: boolean
  widget_launcher: WidgetLauncher
  widget_custom_css: string
  welcome_messages: string[]
  quick_replies: string[]
  proactive_messages: ProactiveMessage[]
  widget_devices: WidgetDevices
  widget_hidden_paths: string[]
  widget_allowed_domains: string[]
  is_online: boolean
}

export interface UpdateWidgetConfigRequest {
  widget_color?: string
  widget_greeting?: string
  widget_position?: WidgetPosition
  widget_launcher?: WidgetLauncher
  widget_custom_css?: string
  widget_icon_url?: string
  widget_width?: number
  widget_height?: number
  widget_offset_x?: number
  widget_offset_y?: number
}

export interface UpdateBusinessHoursRequest {
  business_hours_enabled: boolean
  business_hours_timezone: string
  business_hours: BusinessHoursDay[]
  away_message: string
}

export interface UpdatePreChatFormRequest {
  pre_chat_name: FieldRequirement
  pre_chat_email: FieldRequirement
  // New questions have no id yet; the API assigns one.
  pre_chat_fields: (Omit<PreChatField, 'id'> & { id?: string })[]
}

export const rotateInviteToken = (): Promise<{ invite_token: string }> =>
  client.post<{ invite_token: string }>('/organizations/invite/rotate').then((r) => r.data)

export const sendInviteEmail = (email: string): Promise<void> =>
  client.post('/organizations/invite/send-email', { email }).then(() => undefined)

export const getMembers = (): Promise<Member[]> =>
  client.get<Member[]>('/organizations/members').then((r) => r.data)

export const updateMemberRole = (memberId: string, role: UserRole): Promise<Member> =>
  client.patch<Member>(`/organizations/members/${memberId}/role`, { role }).then((r) => r.data)

export const removeMember = (memberId: string): Promise<void> =>
  client.delete(`/organizations/members/${memberId}`).then(() => undefined)

export const getWidgetConfig = (widgetKey: string): Promise<WidgetConfig> =>
  client.get<WidgetConfig>(`/organizations/widget/${widgetKey}`).then((r) => r.data)

export const updateWidgetConfig = (data: UpdateWidgetConfigRequest): Promise<Organization> =>
  client.patch<Organization>('/organizations/widget', data).then((r) => r.data)

export const updateBusinessHours = (data: UpdateBusinessHoursRequest): Promise<Organization> =>
  client.put<Organization>('/organizations/business-hours', data).then((r) => r.data)

export const updatePreChatForm = (data: UpdatePreChatFormRequest): Promise<Organization> =>
  client.put<Organization>('/organizations/pre-chat-form', data).then((r) => r.data)

export const updateAutoAssign = (autoAssign: boolean): Promise<Organization> =>
  client.put<Organization>('/organizations/auto-assign', { auto_assign: autoAssign }).then((r) => r.data)

export const updateTypingPreview = (enabled: boolean): Promise<Organization> =>
  client.put<Organization>('/organizations/typing-preview', { typing_preview: enabled }).then((r) => r.data)

export const updateWelcome = (welcome: { welcome_messages: string[]; quick_replies: string[] }): Promise<Organization> =>
  client.put<Organization>('/organizations/welcome', welcome).then((r) => r.data)

export const updateProactiveMessages = (messages: ProactiveMessage[]): Promise<Organization> =>
  client.put<Organization>('/organizations/proactive-messages', { proactive_messages: messages }).then((r) => r.data)

// How many chats each proactive message has started.
export const getProactiveStats = (): Promise<{ id: string; chats: number }[]> =>
  client.get<{ id: string; chats: number }[]>('/organizations/proactive-messages/stats').then((r) => r.data)

export const updateDisplayRules = (rules: {
  widget_devices: WidgetDevices
  widget_hidden_paths: string[]
  widget_allowed_domains: string[]
}): Promise<Organization> => client.put<Organization>('/organizations/display-rules', rules).then((r) => r.data)

export const updateResponseTarget = (minutes: number | null): Promise<Organization> =>
  client.put<Organization>('/organizations/response-target', { first_response_minutes: minutes }).then((r) => r.data)

export const getTeammates = (): Promise<Teammate[]> =>
  client.get<Teammate[]>('/organizations/teammates').then((r) => r.data)
