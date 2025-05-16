import { useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    const fetchToken = async () => {
      const code = router.query.code;
      if (!code) return;

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code as string);
      params.append('redirect_uri', 'http://localhost:3000/callback');
      params.append('client_id', process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!);
      params.append('client_secret', process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET!);

      const res = await axios.post('https://accounts.spotify.com/api/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      localStorage.setItem('spotify_access_token', res.data.access_token);
      router.push('/');
    };

    fetchToken();
  }, [router]);

  return <p>Logging in...</p>;
}
