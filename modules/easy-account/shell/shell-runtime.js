(function () {
  "use strict";

  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const antd = window.antd;
  const antIcons = window.icons || window.antdIcons || window.AntDesignIcons || {};

  function mountAntIcons(scope) {
    if (!React || !ReactDOM) {
      throw new Error("EasyAccountShell: React and ReactDOM are required for Ant Design icons");
    }

    scope.querySelectorAll("[data-ant-icon]").forEach((host) => {
      const Icon = antIcons[host.dataset.antIcon];
      if (!Icon) {
        throw new Error(`EasyAccountShell: Ant Design icon not found: ${host.dataset.antIcon}`);
      }
      ReactDOM.render(React.createElement(Icon), host);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeTabs(items) {
    return (items || []).map((item, index) => ({
      id: String(item.id || `tab-${index + 1}`),
      label: item.label || `标签 ${index + 1}`,
      closable: item.closable !== false,
      pinned: Boolean(item.pinned),
      content: item.content,
    }));
  }

  function normalizeMenu(items) {
    return (items || []).map((item, index) => {
      const key = String(item.id || `menu-group-${index + 1}`);
      const Icon = antIcons[item.icon || "AppstoreOutlined"];
      return {
        key,
        label: item.label,
        icon: Icon ? React.createElement(Icon) : undefined,
        children: (item.children || []).map((child) => ({
          key: String(child.id || child.label),
          label: child.label,
        })),
      };
    });
  }

  function mount(options) {
    const config = Object.assign({}, window.EASY_ACCOUNT_SHELL_CONFIG || {}, options || {});
    const root = document.querySelector(config.target || "#app");
    if (!root) throw new Error("EasyAccountShell: target element not found");

    const state = {
      tabs: normalizeTabs(config.tabs),
      activeTabId:
        String(config.activeTabId || config.tabs?.find((item) => item.active)?.id || "") ||
        String(config.tabs?.[0]?.id || "tab-1"),
      collapsed:
        typeof config.collapsed === "boolean"
          ? config.collapsed
          : window.matchMedia("(max-width: 1023px)").matches,
      selectedMenuId: String(
        config.activeTabId ||
          config.menu?.flatMap((item) => item.children || []).find((child) => child.active)?.id ||
          "",
      ),
      openMenuKeys: (config.menu || [])
        .map((item, index) => ({ item, key: String(item.id || `menu-group-${index + 1}`) }))
        .filter(({ item }) => item.open || item.children?.some((child) => child.active))
        .map(({ key }) => key),
    };

    root.innerHTML = `
      <div class="ea-shell${state.collapsed ? " is-sidebar-collapsed" : ""}" data-shell>
        <aside class="ea-sidebar">
          <a class="ea-brand" href="#" aria-label="${escapeHtml(config.brand?.name || "Yee账通")}">
            <img class="ea-brand__image ea-brand__image--full" src="${escapeHtml(config.brand?.logo || "./assets/logo-txt@3x.png")}" alt="${escapeHtml(config.brand?.name || "Yee账通")}" />
            <img class="ea-brand__image ea-brand__image--icon" src="${escapeHtml(config.brand?.icon || "./assets/logo.png")}" alt="" aria-hidden="true" />
          </a>
          <nav class="ea-menu" aria-label="侧边导航" data-shell-menu></nav>
          <div class="ea-sidebar__bottom">
            <button class="ea-sidebar-toggle" type="button" aria-label="${state.collapsed ? "展开侧栏" : "收起侧栏"}" title="${state.collapsed ? "展开侧栏" : "收起侧栏"}"><span data-sidebar-icon data-ant-icon="${state.collapsed ? "MenuUnfoldOutlined" : "MenuFoldOutlined"}" aria-hidden="true"></span></button>
            <button class="ea-pin-button" type="button" aria-label="固定侧栏" title="固定侧栏"><span data-ant-icon="PushpinOutlined" aria-hidden="true"></span></button>
          </div>
        </aside>

        <header class="ea-tabbar">
          <button class="ea-tabbar__toggle" type="button" aria-label="${state.collapsed ? "展开侧栏" : "收起侧栏"}" title="${state.collapsed ? "展开侧栏" : "收起侧栏"}"><span data-sidebar-icon data-ant-icon="${state.collapsed ? "MenuUnfoldOutlined" : "MenuFoldOutlined"}" aria-hidden="true"></span></button>
          <div class="ea-tabs" role="tablist" aria-label="已打开页面" data-shell-tabs></div>
          <div class="ea-tabbar__account">
            <span class="ea-avatar" title="${escapeHtml(config.user?.name || "账号")}">${escapeHtml(config.user?.initials || "OU")}</span>
          </div>
        </header>

        <main class="ea-main">
          <div class="ea-content-slot" data-shell-content></div>
          <footer class="ea-footer">${escapeHtml(config.footer || "")}</footer>
        </main>
      </div>`;

    mountAntIcons(root);

    const shell = root.querySelector("[data-shell]");
    const menuRoot = root.querySelector("[data-shell-menu]");
    const tabsRoot = root.querySelector("[data-shell-tabs]");
    const contentSlot = root.querySelector("[data-shell-content]");

    function drawMenu() {
      if (!antd?.Menu) {
        throw new Error("EasyAccountShell: Ant Design Menu is required");
      }
      const ExpandIcon = antIcons.DownOutlined;

      ReactDOM.render(
        React.createElement(antd.Menu, {
          mode: "inline",
          inlineCollapsed: state.collapsed,
          items: normalizeMenu(config.menu),
          selectedKeys: state.selectedMenuId ? [state.selectedMenuId] : [],
          openKeys: state.collapsed ? [] : state.openMenuKeys,
          expandIcon: ExpandIcon
            ? ({ isOpen }) =>
                React.createElement(ExpandIcon, {
                  className: `ea-menu__expand-icon${isOpen ? " is-open" : ""}`,
                })
            : undefined,
          onOpenChange: (keys) => {
            state.openMenuKeys = keys.map(String);
            drawMenu();
          },
          onClick: ({ key }) => {
            state.selectedMenuId = String(key);
            drawMenu();
            const matchingTab = state.tabs.find((tab) => tab.id === String(key));
            if (matchingTab) activateTab(matchingTab.id);
          },
        }),
        menuRoot,
      );
    }

    function renderContent(tab) {
      const candidate = tab?.content ?? config.contentByTab?.[tab?.id] ?? config.content;
      contentSlot.replaceChildren();
      const resolved = typeof candidate === "function" ? candidate(tab) : candidate;
      if (resolved instanceof Node) contentSlot.append(resolved);
      else if (typeof resolved === "string" && resolved.trim()) contentSlot.innerHTML = resolved;
      else {
        const emptyPage = document.createElement("div");
        emptyPage.className = "ea-shell-empty-page";
        const emptySurface = document.createElement("section");
        emptySurface.className = "ea-shell-empty-surface";
        emptySurface.setAttribute("aria-label", "页面暂未接入");
        emptyPage.append(emptySurface);
        contentSlot.append(emptyPage);
        ReactDOM.render(
          React.createElement(antd.Empty, { description: "页面暂未接入" }),
          emptySurface,
        );
      }
    }

    function emitTabChange(tab) {
      renderContent(tab);
      root.dispatchEvent(new CustomEvent("easyaccount:tabchange", { detail: { tab } }));
      if (typeof config.onTabChange === "function") config.onTabChange(tab);
    }

    function drawTabs(options) {
      const focusActive = options?.focusActive;
      tabsRoot.innerHTML = state.tabs
        .map((tab) => {
          const active = tab.id === state.activeTabId;
          return `
            <button class="ea-tab${active ? " is-active" : ""}" type="button" role="tab"
              aria-selected="${active}" tabindex="${active ? "0" : "-1"}" data-tab-id="${escapeHtml(tab.id)}" title="${escapeHtml(tab.label)}">
              ${tab.pinned ? '<span class="ea-tab__pin" data-ant-icon="PushpinFilled" aria-hidden="true"></span>' : ""}
              <span class="ea-tab__label">${escapeHtml(tab.label)}</span>
              ${tab.closable && !tab.pinned ? '<span class="ea-tab__close" role="button" aria-label="关闭标签" title="关闭标签" tabindex="-1"><span data-ant-icon="CloseOutlined" aria-hidden="true"></span></span>' : ""}
            </button>`;
        })
        .join("");
      mountAntIcons(tabsRoot);
      const activeButton = tabsRoot.querySelector(`[data-tab-id="${CSS.escape(state.activeTabId)}"]`);
      activeButton?.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (focusActive) activeButton?.focus();
    }

    function activateTab(id, focusActive) {
      const tab = state.tabs.find((item) => item.id === id);
      if (!tab) return;
      state.activeTabId = tab.id;
      state.selectedMenuId = tab.id;
      drawMenu();
      drawTabs({ focusActive });
      emitTabChange(tab);
    }

    function closeTab(id) {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      const tab = state.tabs[index];
      if (!tab || tab.pinned || !tab.closable || state.tabs.length === 1) return;
      state.tabs.splice(index, 1);
      if (state.activeTabId === id) {
        state.activeTabId = state.tabs[Math.max(0, index - 1)]?.id || state.tabs[0]?.id;
        emitTabChange(state.tabs.find((item) => item.id === state.activeTabId));
      }
      drawTabs({ focusActive: true });
      root.dispatchEvent(new CustomEvent("easyaccount:tabclose", { detail: { tab } }));
    }

    function toggleSidebar() {
      state.collapsed = !state.collapsed;
      shell.classList.toggle("is-sidebar-collapsed", state.collapsed);
      drawMenu();
      const iconName = state.collapsed ? "MenuUnfoldOutlined" : "MenuFoldOutlined";
      const label = state.collapsed ? "展开侧栏" : "收起侧栏";
      root.querySelectorAll("[data-sidebar-icon]").forEach((host) => {
        host.dataset.antIcon = iconName;
      });
      root.querySelectorAll(".ea-sidebar-toggle, .ea-tabbar__toggle").forEach((button) => {
        button.setAttribute("aria-label", label);
        button.title = label;
      });
      mountAntIcons(root);
    }

    tabsRoot.addEventListener("click", (event) => {
      const tabButton = event.target.closest("[data-tab-id]");
      if (!tabButton) return;
      if (event.target.closest(".ea-tab__close")) closeTab(tabButton.dataset.tabId);
      else activateTab(tabButton.dataset.tabId);
    });

    tabsRoot.addEventListener("keydown", (event) => {
      const current = event.target.closest("[data-tab-id]");
      if (!current) return;
      const index = state.tabs.findIndex((tab) => tab.id === current.dataset.tabId);
      if (event.key === "Delete") closeTab(current.dataset.tabId);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const next = state.tabs[(index + direction + state.tabs.length) % state.tabs.length];
        activateTab(next.id, true);
      }
    });

    root.querySelector(".ea-sidebar-toggle").addEventListener("click", toggleSidebar);
    root.querySelector(".ea-tabbar__toggle").addEventListener("click", toggleSidebar);

    drawMenu();
    drawTabs();
    const activeTab = state.tabs.find((item) => item.id === state.activeTabId) || state.tabs[0];
    if (activeTab) {
      state.activeTabId = activeTab.id;
      emitTabChange(activeTab);
    }

    return {
      root,
      config,
      contentSlot,
      getTabs: () => state.tabs.map((tab) => ({ ...tab })),
      getActiveTab: () => state.tabs.find((tab) => tab.id === state.activeTabId),
      activateTab,
      closeTab,
      toggleSidebar,
    };
  }

  window.EasyAccountShell = { mount };
})();
