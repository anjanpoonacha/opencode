import { createEffect, createMemo, Show, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate, useParams } from "@solidjs/router"
import { SDKProvider } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { LocalProvider } from "@/context/local"
import { useSDK } from "@/context/sdk"

import { DataProvider } from "@opencode-ai/ui/context"
import { decode64 } from "@/utils/base64"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"

function DirectoryDataProvider(props: ParentProps<{ directory: string }>) {
  const params = useParams()
  const navigate = useNavigate()
  const sync = useSync()
  const sdk = useSDK()

  return (
    <DataProvider
      data={sync.data}
      directory={props.directory}
      onNavigateToSession={(sessionID: string) => navigate(`/${params.dir}/session/${sessionID}`)}
      onSessionHref={(sessionID: string) => `/${params.dir}/session/${sessionID}`}
      onFetchAppResource={async (server, uri) => {
        const res = await fetch(
          `${sdk.url}/experimental/mcp-app/resource?uri=${encodeURIComponent(uri)}&server=${encodeURIComponent(server)}`,
        ).catch(() => undefined)
        if (!res?.ok) return undefined
        const data = (await res.json()) as { html: string } | undefined
        if (typeof data?.html === "string" && data.html.includes("export{")) return undefined
        return data
      }}
      onCallAppTool={async (server, name, args) => {
        const res = await fetch(`${sdk.url}/experimental/mcp-app/tool-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ server, name, arguments: args ?? {} }),
        }).catch(() => undefined)
        if (!res?.ok) return { content: [] }
        return res.json()
      }}
    >
      <LocalProvider>{props.children}</LocalProvider>
    </DataProvider>
  )
}

export default function Layout(props: ParentProps) {
  const params = useParams()
  const navigate = useNavigate()
  const language = useLanguage()
  const [store, setStore] = createStore({ invalid: "" })
  const directory = createMemo(() => {
    return decode64(params.dir) ?? ""
  })

  createEffect(() => {
    if (!params.dir) return
    if (directory()) return
    if (store.invalid === params.dir) return
    setStore("invalid", params.dir)
    showToast({
      variant: "error",
      title: language.t("common.requestFailed"),
      description: language.t("directory.error.invalidUrl"),
    })
    navigate("/", { replace: true })
  })
  return (
    <Show when={directory()}>
      <SDKProvider directory={directory}>
        <SyncProvider>
          <DirectoryDataProvider directory={directory()}>{props.children}</DirectoryDataProvider>
        </SyncProvider>
      </SDKProvider>
    </Show>
  )
}
