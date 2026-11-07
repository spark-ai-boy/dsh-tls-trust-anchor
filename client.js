window.__ModuleLoader__.load({
  id: "dsh-tls-trust-anchor",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useState } = React;

    const NS = "tls-trust-anchor";
    const NAMESPACE = "tlsTrust";

    const DICT = {
      en: {
        nav: "Certificate trust",
        title: "Certificate trust",
        subtitle:
          "Hosts listed here skip TLS certificate verification. Only add a host whose certificate you trust, such as a private model gateway.",
        inputPlaceholder: "newapi.example.com",
        add: "Add host",
        remove: "Remove",
        empty: "No host trusted yet. Every connection uses standard certificate verification.",
        skipVerify: "Skip certificate verification",
        verified: "Standard verification",
        warning: "Verification is disabled for this host, so the connection is encrypted but its identity is not proven.",
        saved: "Saved",
        failed: "Failed"
      },
      zh: {
        nav: "证书信任",
        title: "证书信任",
        subtitle:
          "列表中的主机会跳过 TLS 证书校验。只添加你自己信任的证书主机，例如局域网里的模型网关。",
        inputPlaceholder: "newapi.example.com",
        add: "添加主机",
        remove: "移除",
        empty: "还没有信任任何主机，所有连接都按标准规则校验证书。",
        skipVerify: "跳过证书校验",
        verified: "标准校验",
        warning: "该主机已关闭校验：连接仍然加密，但无法证明对端身份。",
        saved: "已保存",
        failed: "操作失败"
      }
    };

    const METHODS = [
      ["listHosts", []],
      ["addHost", ["host"]],
      ["removeHost", ["host"]],
      ["setHostSkipVerify", ["host", "value"]]
    ];

    const strictCodec = (subject) => ({
      mode: "strict",
      typeSymbol: `dsh-tls-trust-anchor#${subject}`,
      create: () => ({ parse: (value) => value })
    });

    function apply(ctx) {
      let lang = "en";
      const readActiveLocale = () => {
        try {
          const active = ctx.locale?.active;
          const name = typeof active === "string" ? active : active?.locale;
          if (typeof name === "string" && DICT[name.slice(0, 2)]) lang = name.slice(0, 2);
          else lang = String(navigator?.language || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
        } catch {
          lang = "en";
        }
      };
      readActiveLocale();
      ctx.effect(() => {
        const unsubscribe = ctx.locale?.subscribe?.(readActiveLocale);
        return () => {
          if (typeof unsubscribe === "function") unsubscribe();
        };
      }, "tls-trust-anchor: active locale");
      ctx.effect(() => ctx.locale.register(NS, DICT), "tls-trust-anchor: locale");

      const text = (key) => (DICT[lang] ?? DICT.en)[key] ?? key;

      const remoteContribution = {
        package: "dsh-tls-trust-anchor",
        descriptors: METHODS.map(([method, parameters]) => ({
          id: `dsh-tls-trust-anchor#${NAMESPACE}/${method}`,
          namespace: NAMESPACE,
          method,
          service: NAMESPACE,
          invocation: { kind: "direct" },
          description: `Certificate trust: ${method}`,
          parameters: parameters.map((parameter) => ({
            name: parameter,
            wire: parameter,
            source: "json",
            codec: strictCodec(`${NAMESPACE}/${method}:${parameter}`),
            description: parameter
          })),
          result: strictCodec(`${NAMESPACE}/${method}:result`)
        })),
        methods: {}
      };

      const mounted = ctx.remote.$mount(remoteContribution);
      mounted.catch(() => {});
      ctx.effect(
        () => () => {
          void mounted.then((dispose) => dispose()).catch(() => {});
        },
        "tls-trust-anchor: remote contribution"
      );

      async function call(method, ...args) {
        await mounted;
        let namespace;
        if (typeof ctx.get === "function") {
          try {
            namespace = ctx.get(`remote.${NAMESPACE}`);
          } catch {}
        }
        if (!namespace) {
          try {
            namespace = ctx.remote[NAMESPACE];
          } catch {}
        }
        if (!namespace || typeof namespace[method] !== "function") {
          throw new Error("TLS trust host service is not available.");
        }
        const result = await namespace[method](...args);
        if (result && typeof result.ok === "boolean") {
          if (!result.ok) throw new Error(result.error?.message || "Remote call failed.");
          return result.value;
        }
        return result;
      }

      const api = { call };

      const card = {
        border: "1px solid var(--dsw-alias-border-l2, rgba(20,20,25,.1))",
        borderRadius: 10,
        background: "var(--dsw-alias-bg-layer-1, #fff)"
      };
      const buttonStyle = {
        height: 30,
        padding: "0 12px",
        borderRadius: 7,
        border: "1px solid var(--dsw-alias-border-l2, rgba(20,20,25,.12))",
        background: "var(--dsw-alias-bg-layer-2, #f4f4f2)",
        color: "var(--dsw-alias-label-primary, #1d1d20)",
        fontSize: 12,
        cursor: "pointer"
      };

      function Switch({ checked, onChange, label }) {
        return h(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": checked,
            "aria-label": label,
            onClick: () => onChange(!checked),
            style: {
              position: "relative",
              width: 38,
              height: 22,
              borderRadius: 11,
              border: "none",
              cursor: "pointer",
              background: checked
                ? "var(--dsw-alias-state-warn-primary, #c8873a)"
                : "var(--dsw-alias-border-l3, rgba(20,20,25,.18))",
              transition: "background .16s",
              flex: "0 0 auto"
            }
          },
          h("span", {
            style: {
              position: "absolute",
              top: 2,
              left: checked ? 18 : 2,
              width: 18,
              height: 18,
              borderRadius: 9,
              background: "#fff",
              transition: "left .16s"
            }
          })
        );
      }

      function TrustSection({ api: injectedApi }) {
        const callRemote = (injectedApi ?? api).call;
        const [hosts, setHosts] = useState([]);
        const [draft, setDraft] = useState("");
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState("");

        const refresh = useCallback(async () => {
          try {
            setHosts((await callRemote("listHosts")) ?? []);
          } catch (failure) {
            setError(String(failure?.message ?? failure));
          }
        }, [callRemote]);

        useEffect(() => {
          void refresh();
        }, [refresh]);

        const mutate = async (work) => {
          setBusy(true);
          setError("");
          try {
            setHosts((await work()) ?? []);
          } catch (failure) {
            setError(String(failure?.message ?? failure));
          } finally {
            setBusy(false);
          }
        };

        const addHost = () => {
          const value = draft.trim();
          if (value.length === 0) return;
          void mutate(async () => {
            const next = await callRemote("addHost", value);
            setDraft("");
            return next;
          });
        };

        return h(
          "section",
          { style: { padding: "4px 0 32px", color: "var(--dsw-alias-label-primary, #1d1d20)" } },
          h("h2", { style: { fontSize: 18, fontWeight: 600, margin: "0 0 6px" } }, text("title")),
          h(
            "p",
            {
              style: {
                margin: "0 0 18px",
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--dsw-alias-label-tertiary, #6e7078)",
                maxWidth: 640
              }
            },
            text("subtitle")
          ),
          h(
            "div",
            { style: { display: "flex", gap: 8, marginBottom: 16, maxWidth: 520 } },
            h("input", {
              value: draft,
              disabled: busy,
              placeholder: text("inputPlaceholder"),
              onChange: (event) => setDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === "Enter") addHost();
              },
              style: {
                flex: "1 1 auto",
                height: 32,
                padding: "0 10px",
                borderRadius: 7,
                border: "1px solid var(--dsw-alias-border-l2, rgba(20,20,25,.14))",
                background: "var(--dsw-alias-bg-base, #fff)",
                color: "inherit",
                fontSize: 13,
                fontFamily: "inherit"
              }
            }),
            h("button", { type: "button", onClick: addHost, disabled: busy, style: buttonStyle }, text("add"))
          ),
          error.length > 0
            ? h(
                "p",
                {
                  style: {
                    margin: "0 0 12px",
                    fontSize: 12,
                    color: "var(--dsw-alias-state-error-primary, #b23b3b)"
                  }
                },
                `${text("failed")}: ${error}`
              )
            : null,
          hosts.length === 0
            ? h(
                "p",
                {
                  style: {
                    margin: 0,
                    padding: "18px 16px",
                    fontSize: 12.5,
                    ...card,
                    color: "var(--dsw-alias-label-tertiary, #6e7078)"
                  }
                },
                text("empty")
              )
            : h(
                "ul",
                { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, maxWidth: 640 } },
                hosts.map((entry) =>
                  h(
                    "li",
                    {
                      key: entry.host,
                      style: {
                        ...card,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12
                      }
                    },
                    h(
                      "div",
                      { style: { flex: "1 1 auto", minWidth: 0 } },
                      h(
                        "div",
                        {
                          style: {
                            fontSize: 13,
                            fontWeight: 500,
                            fontFamily: "var(--dsw-font-mono, ui-monospace, Menlo, monospace)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }
                        },
                        entry.host
                      ),
                      h(
                        "div",
                        {
                          style: {
                            marginTop: 3,
                            fontSize: 11.5,
                            color: entry.skipVerify
                              ? "var(--dsw-alias-state-warn-label, #a86d18)"
                              : "var(--dsw-alias-label-caption, #9698a0)"
                          }
                        },
                        entry.skipVerify ? text("warning") : text("verified")
                      )
                    ),
                    h(Switch, {
                      checked: entry.skipVerify,
                      label: text("skipVerify"),
                      onChange: (next) =>
                        void mutate(() => callRemote("setHostSkipVerify", entry.host, next))
                    }),
                    h(
                      "button",
                      {
                        type: "button",
                        disabled: busy,
                        onClick: () => void mutate(() => callRemote("removeHost", entry.host)),
                        style: {
                          ...buttonStyle,
                          color: "var(--dsw-alias-state-error-primary, #b23b3b)"
                        }
                      },
                      text("remove")
                    )
                  )
                )
              )
        );
      }

      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "tls-trust",
            order: 90,
            label: () => text("nav"),
            inject: () => ({ api })
          },
          TrustSection
        )
      );
    }

    return { inject: ["slots", "remote", "locale"], apply };
  }
});
