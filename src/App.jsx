import { useCallback, useMemo, useState } from 'react';
import { request, saveTokens } from './api.js';

const blankProduct = { product_name: '', description: '', price: '', quantity: '' };
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authForm, setAuthForm] = useState({ identifier: '', username: '', email: '', password: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [productForm, setProductForm] = useState(blankProduct);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await request('/products');
      setProducts(result.data || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      `${product.product_name} ${product.description || ''}`.toLowerCase().includes(term),
    );
  }, [products, search]);

  const inventoryValue = useMemo(
    () => products.reduce((total, product) => total + Number(product.price) * Number(product.quantity), 0),
    [products],
  );
  const lowStock = products.filter((product) => Number(product.quantity) < 10).length;

  async function submitAuth(event) {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setMessage('');
    try {
      const payload = authMode === 'login'
        ? { identifier: authForm.identifier, password: authForm.password }
        : { username: authForm.username, email: authForm.email, password: authForm.password };
      const result = await request(`/auth/${authMode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      saveTokens(result.tokens);
      setUser(result.user);
      setAuthForm({ identifier: '', username: '', email: '', password: '' });
      await loadProducts();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    let logoutError = null;
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: localStorage.getItem('refreshToken') }),
      });
    } catch (error) {
      logoutError = error;
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setProducts([]);
    setMessage(logoutError ? `Signed out on this device, but the API logout request failed: ${logoutError.message}` : '');
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setProductForm(blankProduct);
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditing(product.id);
    setModalOpen(true);
    setProductForm({
      product_name: product.product_name,
      description: product.description || '',
      price: product.price,
      quantity: String(product.quantity),
    });
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await request(editing ? `/products/${editing}` : '/products', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ ...productForm, price: Number(productForm.price), quantity: Number(productForm.quantity) }),
      });
      setEditing(null);
      setProductForm(blankProduct);
      setModalOpen(false);
      await loadProducts();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.product_name}"? This cannot be undone.`)) return;
    try {
      await request(`/products/${product.id}`, { method: 'DELETE' });
      await loadProducts();
      setMessage('Product deleted.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-aside">
          <a className="brand brand-light" href="/">
            <span className="brand-mark">P</span>
            <span>Peachstock <b>INVENTORY STUDIO</b></span>
          </a>
          <div className="aside-copy">
            <p className="eyebrow">A LITTLE SPACE TO GROW</p>
            <h1>A sweeter way<br />to stock up.</h1>
            <p>Keep your favorite finds organized, spot what’s running low, and make room for what comes next.</p>
          </div>
          <div className="aside-foot"><span>SECURE API ACCESS</span><span>BUILT WITH LAVALUST</span></div>
        </section>
        <section className="auth-main">
          <div className="auth-card">
            <span className="eyebrow">{authMode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</span>
            <h2>{authMode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</h2>
            <p className="muted">{authMode === 'login' ? 'Enter your credentials to continue.' : 'Your account gives you secure access to product management.'}</p>
            {message && <div className="notice error-notice">{message}</div>}
            <form onSubmit={submitAuth} className="stack-form">
              {authMode === 'register' ? (
                <>
                  <label>Username<input required minLength="2" maxLength="100" autoComplete="username" value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })} /></label>
                  <label>Email address<input required type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
                </>
              ) : (
                <label>Email or username<input required autoComplete="username" value={authForm.identifier} onChange={(e) => setAuthForm({ ...authForm, identifier: e.target.value })} /></label>
              )}
              <label>Password<input required minLength="8" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} /></label>
              <button type="submit" className="button button-primary button-wide" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
            </form>
            <p className="auth-switch">
              {authMode === 'login' ? 'New to Peachstock?' : 'Already have an account?'}
              {' '}<button onClick={() => { setMessage(''); setAuthMode(authMode === 'login' ? 'register' : 'login'); }}> {authMode === 'login' ? 'Create an account' : 'Sign in'}</button>
            </p>
            <p className="auth-note">Your password is securely hashed. Product data travels through the LavaLust API.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark">P</span><span>Peachstock <b>INVENTORY STUDIO</b></span></a>
        <div className="side-label">WORKSPACE</div>
        <div className="side-link active"><span className="side-icon">▦</span> Products <span className="side-count">{products.length}</span></div>
        <div className="sidebar-bottom"><div className="secure-indicator"><span></span> API connection secure</div><div className="side-profile"><div className="avatar">{user.username?.slice(0, 1).toUpperCase()}</div><div className="profile-text"><strong>{user.username}</strong><span>{user.email}</span></div><button className="logout-button" onClick={logout} title="Sign out" aria-label="Sign out">↗</button></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div><span className="breadcrumb">Workspace <span>/</span> Products</span><h1>Products</h1></div><button className="button button-primary" onClick={openCreate}><span className="plus">＋</span> Add product</button></header>
        <div className="content-wrap">
          <div className="welcome-row"><div><p className="eyebrow">YOUR LITTLE CORNER OF COMMERCE</p><h2>Looking lovely, {user.username}!</h2><p>Here’s what’s happening with your inventory today.</p></div><div className="today-pill"><span></span> All caught up</div></div>
          <section className="stats-grid">
            <article className="stat-card"><div className="stat-top"><span>Total products</span><span className="stat-icon icon-blue">▦</span></div><strong>{products.length}</strong><small>Items in your catalog</small></article>
            <article className="stat-card"><div className="stat-top"><span>Inventory value</span><span className="stat-icon icon-green">₱</span></div><strong>{money.format(inventoryValue)}</strong><small>Based on current quantity</small></article>
            <article className="stat-card"><div className="stat-top"><span>Low stock</span><span className="stat-icon icon-amber">⌁</span></div><strong>{lowStock}</strong><small>Products below 10 units</small></article>
          </section>

          {message && <div className="notice">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message">×</button></div>}
          <section className="table-card">
            <div className="table-heading"><div><h2>Product catalog</h2><p>All products currently tracked in your workspace.</p></div><label className="search-box"><span>⌕</span><input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
            {loading ? <div className="empty-state"><div className="loader"></div><p>Loading your products…</p></div> : filteredProducts.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">▦</div><strong>{search ? 'No matching products' : 'Your catalog is ready'}</strong><p>{search ? 'Try a different search term.' : 'Add your first product to start tracking your inventory.'}</p>{!search && <button className="button button-secondary" onClick={openCreate}>＋ Add your first product</button>}</div>
            ) : (
              <div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>PRICE</th><th>QUANTITY</th><th>ADDED</th><th></th></tr></thead><tbody>{filteredProducts.map((product) => (
                <tr key={product.id}><td><div className="product-cell"><div className="product-thumb">{product.product_name.slice(0, 1).toUpperCase()}</div><div><strong>{product.product_name}</strong><span>{product.description || 'No description'}</span></div></div></td><td className="price-cell">{money.format(Number(product.price))}</td><td><span className={`stock-badge ${Number(product.quantity) < 10 ? 'stock-low' : 'stock-ok'}`}><i></i>{product.quantity} in stock</span></td><td className="date-cell">{new Date(product.created_at).toLocaleDateString()}</td><td><div className="row-actions"><button onClick={() => openEdit(product)} title="Edit product">Edit</button><button className="delete-action" onClick={() => deleteProduct(product)} title="Delete product">Delete</button></div></td></tr>
              ))}</tbody></table></div>
            )}
            <div className="table-footer"><span>Showing <b>{filteredProducts.length}</b> of <b>{products.length}</b> products</span><span>Synced securely with Aiven</span></div>
          </section>
          <footer className="page-footer"><span>PEACHSTOCK <b>·</b> MADE FOR GOOD FINDS</span><span>Powered by LavaLust API</span></footer>
        </div>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setEditing(null); setProductForm(blankProduct); setModalOpen(false); } }}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
            <div className="modal-heading"><div><span className="eyebrow">{editing ? 'UPDATE CATALOG' : 'NEW CATALOG ITEM'}</span><h2 id="product-modal-title">{editing ? 'Edit product' : 'Add a product'}</h2></div><button className="modal-close" onClick={() => { setEditing(null); setProductForm(blankProduct); setModalOpen(false); }} aria-label="Close">×</button></div>
            <form className="stack-form" onSubmit={saveProduct}>
              <label>Product name<input required maxLength="100" autoFocus value={productForm.product_name} onChange={(e) => setProductForm({ ...productForm, product_name: e.target.value })} placeholder="e.g. Studio headphones" /></label>
              <label>Description <span className="optional">OPTIONAL</span><textarea rows="3" maxLength="65535" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="A short description of the product" /></label>
              <div className="form-grid"><label>Price <div className="input-prefix"><span>₱</span><input required type="number" min="0" max="99999999.99" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="0.00" /></div></label><label>Quantity<input required type="number" min="0" max="2147483647" step="1" value={productForm.quantity} onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })} placeholder="0" /></label></div>
              <div className="modal-actions"><button type="button" className="button button-plain" onClick={() => { setEditing(null); setProductForm(blankProduct); setModalOpen(false); }}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
