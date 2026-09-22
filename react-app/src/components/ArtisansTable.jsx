import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5001';

export default function ArtisansTable() {
  const [artisans, setArtisans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Empty dependency array: fetch once when the component mounts, not on every render.
  useEffect(() => {
    fetch(`${API_URL}/artisans`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        setArtisans(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading artisans...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Trade</th>
          <th>County</th>
          <th>Verified</th>
          <th>Bookings (next 14 days)</th>
        </tr>
      </thead>
      <tbody>
        {artisans.map((artisan) => (
          <tr key={artisan.id}>
            <td>{artisan.id}</td>
            <td>{artisan.name}</td>
            <td>{artisan.trade}</td>
            <td>{artisan.county}</td>
            <td>{artisan.verified ? 'Yes' : 'No'}</td>
            <td>{artisan.busy.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
