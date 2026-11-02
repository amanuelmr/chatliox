import { updateDisplayRules } from '@/api/organizations'
import { normalizeDomain, type DisplayRules } from '@/lib/engage'
import type { WidgetDevices } from '@/types/auth'
import { EditorSection, FIELD_CLASS, TokenInput } from './EditorParts'
import { useOrgDraft } from './useOrgDraft'

export function useDisplayDraft() {
  return useOrgDraft<DisplayRules>(
    (org) => ({
      widget_devices: org.widget_devices ?? 'all',
      widget_hidden_paths: org.widget_hidden_paths ?? [],
      widget_allowed_domains: org.widget_allowed_domains ?? [],
    }),
    updateDisplayRules,
  )
}

const DEVICES: { value: WidgetDevices; label: string }[] = [
  { value: 'all', label: 'All devices' },
  { value: 'desktop', label: 'Desktop only' },
  { value: 'mobile', label: 'Mobile only' },
]

// A page address and device to check the rules against, shown in the preview.
export interface PageTest {
  url: string
  mobile: boolean
}

export default function DisplayEditor({
  state,
  test,
  onTest,
}: {
  state: ReturnType<typeof useDisplayDraft>
  test: PageTest
  onTest: (test: PageTest) => void
}) {
  const { draft, setDraft } = state

  return (
    <>
      <EditorSection title="Devices" hint="Show the chat everywhere, or only on computers or only on phones and tablets.">
        <div className="flex bg-zinc-100 rounded-lg p-0.5 self-start text-sm" role="radiogroup" aria-label="Devices">
          {DEVICES.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={draft.widget_devices === d.value}
              onClick={() => setDraft({ ...draft, widget_devices: d.value })}
              className={`px-3 py-1.5 rounded-md font-medium ${
                draft.widget_devices === d.value ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </EditorSection>

      <EditorSection
        title="Hide on these pages"
        hint="The widget won't load on any page whose address contains one of these, like /checkout or /account."
      >
        <TokenInput
          label="Pages to hide on"
          values={draft.widget_hidden_paths}
          onChange={(widget_hidden_paths) => setDraft({ ...draft, widget_hidden_paths })}
          max={10}
          maxLength={200}
          placeholder="Type part of an address and press Enter, e.g. /checkout"
        />
      </EditorSection>

      <EditorSection
        title="Allowed sites"
        hint="Only load the widget on these sites and their subdomains, so nobody else can put your chat on their pages. Leave empty to allow any site."
      >
        <TokenInput
          label="Allowed sites"
          values={draft.widget_allowed_domains}
          onChange={(widget_allowed_domains) => setDraft({ ...draft, widget_allowed_domains })}
          max={10}
          maxLength={253}
          normalize={normalizeDomain}
          placeholder="Type a site and press Enter, e.g. yourshop.com"
        />
      </EditorSection>

      <EditorSection title="Try a page" hint="Check whether the widget would load on a page, using the rules above.">
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            value={test.url}
            onChange={(e) => onTest({ ...test, url: e.target.value })}
            aria-label="Page address to try"
            className={`${FIELD_CLASS} flex-1 min-w-[14rem]`}
          />
          <label className="flex items-center gap-2 text-xs text-zinc-600 px-1">
            <input
              type="checkbox"
              checked={test.mobile}
              onChange={(e) => onTest({ ...test, mobile: e.target.checked })}
              className="accent-brand-500"
            />
            On a phone
          </label>
        </div>
      </EditorSection>
    </>
  )
}
