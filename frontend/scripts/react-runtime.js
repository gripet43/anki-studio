// ============================================================================
// Anki Modern OS — Self-Contained Offline React 19 VDOM Runtime
// Provides createElement, Fragment, useState, useEffect, useRef, useMemo,
// useSyncExternalStore, dangerouslySetInnerHTML, and createRoot with zero external CDN dependencies.
// ============================================================================

(function () {
  const Fragment = Symbol.for('react.fragment');

  function createElement(type, props, ...children) {
    const flatChildren = [];
    const pushChild = (c) => {
      if (Array.isArray(c)) {
        c.forEach(pushChild);
      } else if (c !== null && c !== undefined && c !== false && c !== true) {
        flatChildren.push(c);
      }
    };
    children.forEach(pushChild);
    return {
      type,
      props: { ...(props || {}), children: flatChildren },
    };
  }

  let currentRoot = null;
  let hookIndex = 0;
  let hooks = [];
  let pendingEffects = [];

  function scheduleRender() {
    if (!currentRoot || currentRoot.scheduled) return;
    currentRoot.scheduled = true;
    queueMicrotask(() => {
      currentRoot.scheduled = false;
      renderRoot(currentRoot);
    });
  }

  function useState(initialValue) {
    const idx = hookIndex++;
    if (hooks.length <= idx) {
      hooks[idx] = typeof initialValue === 'function' ? initialValue() : initialValue;
    }
    const setState = (updater) => {
      const next = typeof updater === 'function' ? updater(hooks[idx]) : updater;
      if (next !== hooks[idx]) {
        hooks[idx] = next;
        scheduleRender();
      }
    };
    return [hooks[idx], setState];
  }

  function useRef(initialValue) {
    const idx = hookIndex++;
    if (hooks.length <= idx) {
      hooks[idx] = { current: initialValue };
    }
    return hooks[idx];
  }

  function useMemo(factory, deps) {
    const idx = hookIndex++;
    const prev = hooks[idx];
    if (!prev || !deps || deps.some((d, i) => d !== prev.deps[i])) {
      const value = factory();
      hooks[idx] = { value, deps };
      return value;
    }
    return prev.value;
  }

  function useEffect(effect, deps) {
    const idx = hookIndex++;
    const prev = hooks[idx];
    const hasChanged = !prev || !deps || deps.some((d, i) => d !== prev.deps[i]);
    if (hasChanged) {
      hooks[idx] = { deps, cleanup: prev ? prev.cleanup : null };
      pendingEffects.push(() => {
        if (hooks[idx].cleanup && typeof hooks[idx].cleanup === 'function') {
          try {
            hooks[idx].cleanup();
          } catch {}
        }
        const cleanup = effect();
        hooks[idx].cleanup = typeof cleanup === 'function' ? cleanup : null;
      });
    }
  }

  function useSyncExternalStore(subscribe, getSnapshot) {
    const [, setVal] = useState(() => getSnapshot());
    useEffect(() => {
      setVal(getSnapshot());
      return subscribe(() => {
        setVal(getSnapshot());
        scheduleRender();
      });
    }, []);
    return getSnapshot();
  }

  const SVG_TAGS = new Set([
    'svg',
    'path',
    'circle',
    'rect',
    'line',
    'polyline',
    'polygon',
    'g',
    'defs',
    'linearGradient',
    'stop',
  ]);

  function createDomNode(vnode) {
    if (typeof vnode === 'string' || typeof vnode === 'number') {
      return document.createTextNode(String(vnode));
    }
    if (!vnode || typeof vnode !== 'object') {
      return document.createTextNode('');
    }
    if (vnode.type === Fragment || vnode.type === React.StrictMode) {
      const frag = document.createDocumentFragment();
      (vnode.props?.children || []).forEach((ch) => {
        frag.appendChild(createDomNode(ch));
      });
      return frag;
    }
    if (typeof vnode.type === 'function') {
      const rendered = vnode.type(vnode.props || {});
      return createDomNode(rendered);
    }

    const tagName = String(vnode.type);
    const isSvg = SVG_TAGS.has(tagName);
    const el = isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', tagName)
      : document.createElement(tagName);

    const props = vnode.props || {};
    let hasInnerHtml = false;

    Object.keys(props).forEach((key) => {
      if (key === 'children' || key === 'key') return;
      const val = props[key];
      if (val === undefined || val === null || val === false) return;

      if (key === 'dangerouslySetInnerHTML' && typeof val === 'object' && val.__html != null) {
        el.innerHTML = String(val.__html);
        hasInnerHtml = true;
      } else if (key === 'ref' && typeof val === 'object') {
        val.current = el;
      } else if (key === 'className') {
        if (isSvg) {
          el.setAttribute('class', val);
        } else {
          el.className = val;
        }
      } else if (key === 'style' && typeof val === 'object') {
        Object.assign(el.style, val);
      } else if (key === 'autoFocus' && val) {
        setTimeout(() => {
          try {
            el.focus();
          } catch {}
        }, 0);
      } else if (key.startsWith('on') && typeof val === 'function') {
        const evt = key.slice(2).toLowerCase();
        if (evt === 'change' && (tagName === 'input' || tagName === 'textarea')) {
          el.addEventListener('input', val);
        } else if (evt === 'doubleclick') {
          el.addEventListener('dblclick', val);
        } else {
          el.addEventListener(evt, val);
        }
      } else if (key === 'value' && (tagName === 'input' || tagName === 'textarea' || tagName === 'select')) {
        el.value = String(val);
        if (tagName === 'select') {
          setTimeout(() => {
            el.value = String(val);
          }, 0);
        }
      } else if (key === 'checked' && tagName === 'input') {
        el.checked = Boolean(val);
      } else {
        const attrName =
          key === 'strokeWidth'
            ? 'stroke-width'
            : key === 'strokeLinecap'
            ? 'stroke-linecap'
            : key === 'strokeDasharray'
            ? 'stroke-dasharray'
            : key === 'strokeDashoffset'
            ? 'stroke-dashoffset'
            : key;
        el.setAttribute(attrName, String(val));
      }
    });

    if (!hasInnerHtml) {
      (props.children || []).forEach((ch) => {
        el.appendChild(createDomNode(ch));
      });
    }

    return el;
  }

  function renderRoot(rootObj) {
    const active = document.activeElement;
    let activeMeta = null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const allInputs = Array.from(rootObj.container.querySelectorAll('input, textarea'));
      const idx = allInputs.indexOf(active);
      activeMeta = {
        idx,
        start: active.selectionStart,
        end: active.selectionEnd,
      };
    }

    hookIndex = 0;
    pendingEffects = [];
    const dom = createDomNode(rootObj.vnode);
    rootObj.container.innerHTML = '';
    rootObj.container.appendChild(dom);

    if (activeMeta && activeMeta.idx >= 0) {
      const allInputs = Array.from(rootObj.container.querySelectorAll('input, textarea'));
      const target = allInputs[activeMeta.idx];
      if (target) {
        target.focus();
        try {
          if (typeof activeMeta.start === 'number') {
            target.setSelectionRange(activeMeta.start, activeMeta.end);
          }
        } catch {}
      }
    }

    const effectsToRun = [...pendingEffects];
    pendingEffects = [];
    effectsToRun.forEach((fn) => fn());
  }

  function createRoot(container) {
    return {
      render(vnode) {
        currentRoot = { container, vnode, scheduled: false };
        renderRoot(currentRoot);
      },
    };
  }

  const React = {
    createElement,
    Fragment,
    StrictMode: Fragment,
    useState,
    useEffect,
    useRef,
    useMemo,
    useSyncExternalStore,
  };

  window.React = React;
  window.ReactDOMClient = { createRoot };
})();
