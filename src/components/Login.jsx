import React, { useState } from 'react';          // useState buradan
import { useNavigate } from 'react-router-dom';   // useNavigate buradan
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();                // useNavigate çağrısı

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');                            // yönlendirme
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2 style={{ textAlign: 'center' }}>OYS Giriş</h2>
      <form onSubmit={handleLogin}>
        <div>
          <input
            type="email"
            placeholder="Email adresiniz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.6rem', marginBottom: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '0.6rem', marginBottom: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '0.7rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontSize: '1rem' }}>
          Giriş Yap
        </button>
        {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
      </form>

     <p style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', marginTop: '1rem' }}>
  Test kullanıcısı oluşturmak için Firebase Console {'>'} Authentication {'>'} Add user
</p>s
    </div>
  );
};

export default Login;