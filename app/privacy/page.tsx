export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: 700, margin: "60px auto", padding: "0 24px", fontFamily: "sans-serif", lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: June 2026</p>

      <h2>What we collect</h2>
      <p>Veltro accesses your Gmail inbox via Google OAuth to read and analyze your emails. We do not store your email content on our servers. We store only metadata such as your email address and account preferences in our secure database.</p>

      <h2>How we use your data</h2>
      <p>Your email data is processed in real time to generate summaries, categories, and task extractions. This data is never sold or shared with third parties. We do not use your data to train AI or machine learning models.</p>

      <h2>Data Protection</h2>
      <p>All data transmitted between your browser and our servers is encrypted using HTTPS/TLS. Your Gmail data is accessed using OAuth 2.0 and is never stored in plain text. Access tokens are stored securely and never exposed publicly.</p>

      <h2>Data Retention and Deletion</h2>
      <p>We retain your account data for as long as your account is active. If you wish to delete your data, you can email us at kakashihatakeclann@gmail.com and we will permanently delete your account and all associated data within 7 days. You can also revoke Veltro's access to your Gmail at any time via your Google Account permissions at myaccount.google.com/permissions.</p>

      <h2>Google API</h2>
      <p>Veltro uses Google APIs. Our use of Google user data complies with the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. We only request the minimum scopes necessary to provide our service.</p>

      <h2>Contact</h2>
      <p>For any privacy questions email us at: kakashihatakeclann@gmail.com</p>
    </main>
  )
}
