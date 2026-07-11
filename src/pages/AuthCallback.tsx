import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase JS auto-parses tokens from the URL hash on load.
    // Wait briefly for onAuthStateChange to hydrate, then route.
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 30; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) navigate('/', { replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!cancelled) navigate('/auth', { replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return <LoadingScreen />;
}
