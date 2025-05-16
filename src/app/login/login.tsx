const Login = () => {
  const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const REDIRECT_URI = 'http://localhost:3000/callback';
  const SCOPE = 'user-read-private user-read-email';

  const loginUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=${SCOPE}`;

  return (
    <div className="p-4">
      <a href={loginUrl}>
        <button className="px-4 py-2 bg-green-600 text-white rounded">Login with Spotify</button>
      </a>
    </div>
  );
};

export default Login;
