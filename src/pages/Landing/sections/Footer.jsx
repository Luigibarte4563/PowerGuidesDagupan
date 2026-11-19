import { Link } from 'react-router-dom';
import logoWordmark from '@/assets/Union.svg';

export default function Footer() {
  return (
    <footer className="foot" role="contentinfo">
      <div className="wrap mx-auto max-w-[1240px] px-[clamp(20px,6.94vw,100px)]">
        <div>
          <p className="q text-justify">With the <em>right information</em> at the <em>right time</em>, you can make <em>smarter decisions</em> and face every blackout with <em>greater confidence</em>.</p>
          <Link className="logo logo--l" to="#top" aria-label="PowerGuide - Home">
            <img
              src={logoWordmark}
              alt=""
              className="shrink-0"
              style={{ height: '34px', width: 'auto', maxWidth: '100%' }}
              aria-hidden="true"
            />
          </Link>
        </div>
        <div className="fr">
          <Link className="btn" href="#contact">
            Sign Up Now
          </Link>
          <div className="links">
            <ul>
              <li><Link to="#about">About Us</Link></li>
              <li><Link to="#goals">Goals</Link></li>
              <li><Link to="#help">Help</Link></li>
            </ul>
            <ul>
              <li><Link to="#terms">Terms & Conditions</Link></li>
              <li><Link to="#privacy">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <small>© 2026 PowerGuide. Team META. All Rights Reserved.</small>
      </div>
    </footer>
  );
}