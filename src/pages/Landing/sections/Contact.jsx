import { useState } from 'react';

export default function Contact() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormState((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    // In a real app, you would send the form data to your backend here
    setTimeout(() => {
      setSubmitted(false);
      setFormState({ name: '', email: '', message: '' });
    }, 3000);
  };

  return (
    <section className="contact wrap" id="contact" aria-labelledby="contact-heading">
      <div className="hd">
        <p className="eyebrow">More questions</p>
        <h2 id="contact-heading">
          Contact <span className="tag"><i>Us</i></span>
        </h2>
        <p className="sub">
          We're here to help! Whether you have questions,
          feedback, or need support, our team is ready to assist
          you.
        </p>
      </div>

      <div className="cgrid">
        <div>
          <h3>Get in <em>Touch</em></h3>
          <dl>
            <dt>Email:</dt>
            <dd>metaPowerGuide@gmail.com</dd>
            <dt>Phone:</dt>
            <dd>+63 123 456 7890</dd>
            <dt>Address:</dt>
            <dd>
              <address>
                123 Kakupalan Avenue, Suite 456<br />Tech
                District, Dagupan City, Pangasinan<br />Philippines
              </address>
            </dd>
          </dl>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="row">
            <label>
              Name
              <input
                name="name"
                placeholder="Your name"
                autoComplete="name"
                required
                value={formState.name}
                onChange={handleChange}
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="example@gmail.com"
                autoComplete="email"
                required
                value={formState.email}
                onChange={handleChange}
              />
            </label>
          </div>
          <label>
            Message
            <textarea
              name="message"
              placeholder="Write something..."
              required
              value={formState.message}
              onChange={handleChange}
            />
          </label>
          <button type="submit" className="btn">
            {submitted ? 'Message sent' : 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
}