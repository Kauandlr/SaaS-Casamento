'use client';

import { useEffect, useRef } from 'react';

type Turnstile = {
  render: (element: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => string;
  remove: (widgetId: string) => void;
};

function api(): Turnstile | undefined {
  return (window as Window & { turnstile?: Turnstile }).turnstile;
}

export function TurnstileChallenge({
  siteKey,
  action,
  onTokenChange,
}: {
  siteKey: string;
  action: 'login' | 'register';
  onTokenChange: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey) return;
    let widgetId: string | undefined;
    let active = true;
    const render = () => {
      if (active && !widgetId && container.current && api()) {
        widgetId = api()!.render(container.current, {
          sitekey: siteKey,
          action,
          callback: onTokenChange,
          'expired-callback': () => onTokenChange(''),
          'error-callback': () => onTokenChange(''),
        });
      }
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.dataset.turnstileScript = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    render();
    return () => {
      active = false;
      script?.removeEventListener('load', render);
      if (widgetId) api()?.remove(widgetId);
      onTokenChange('');
    };
  }, [siteKey, action, onTokenChange]);

  if (!siteKey) return null;
  return <div ref={container} aria-label="Verificação anti-bot" />;
}
