import Header from './sections/Header';
import Hero from './sections/Hero';
import Blackout from './sections/Blackout';
import About from './sections/About';
import Features from './sections/Features';
import FAQs from './sections/FAQs';
import Contact from './sections/Contact';
import Footer from './sections/Footer';

/** Landing page with exact UI/UX from provided design. */
export default function Landing() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Blackout />
        <About />
        <Features />
        <FAQs />
        <Contact />
      </main>
      <Footer />
    </>
  );
}