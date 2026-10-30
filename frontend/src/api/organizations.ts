import client from './client'
import type { BusinessHoursDay, Member, Organization, UserRole, WidgetPosition } from '@/types/auth'

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
  is_online: boolean
}

export interface UpdateWidgetConfigRequest {
  widget_color?: string
  widget_greeting?: string
  widget_position?: WidgetPosition
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
