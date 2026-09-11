import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5001';

export default function StudentsTable() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Empty dependency array: fetch once when the component mounts, not on every render.
  useEffect(() => {
    fetch(`${API_URL}/api/students`)
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data) => {
        setStudents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading students...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Course</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.id}>
            <td>{student.id}</td>
            <td>{student.name}</td>
            <td>{student.email}</td>
            <td>{student.course}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
