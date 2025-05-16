import { useEffect, useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [accessToken, setAccessToken] = useState('');
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('spotify_access_token');
    if (token) setAccessToken(token);
  }, []);

  const fetchTracks = async () => {
    const res = await axios.get('https://api.spotify.com/v1/browse/new-releases?limit=5', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const items = res.data.albums.items;
    const songData = items.map(album => ({
      name: album.name,
      artist: album.artists[0].name,
      image: album.images[0].url,
      preview_url: album.external_urls.spotify,
    }));

    setTracks(songData);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Spotify Guess Game</h1>
      {!accessToken ? (
        <a href="/login">
          <button className="mt-4 px-4 py-2 bg-green-500 text-white rounded">Login with Spotify</button>
        </a>
      ) : (
        <>
          <button onClick={fetchTracks} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Get Songs</button>
          <ul className="mt-4">
            {tracks.map((track, i) => (
              <li key={i} className="mb-4">
                <img src={track.image} alt={track.name} className="w-24 h-24" />
                <p className="font-semibold">{track.name}</p>
                <p>{track.artist}</p>
                <a href={track.preview_url} target="_blank" className="text-blue-600 underline">Listen</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
