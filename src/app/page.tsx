import type { Metadata } from "next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import './globals.css'

import { GetSectionVisibility, GetSiteSettings } from '@/lib/query/settings.query';
import { GetContent } from '@/lib/query/content.query';
import { ListCaseStudies } from '@/lib/query/caseStudies.query';
import { homeSchema, JsonLd, pageMetadata } from '@/lib/seo';

//Imports of the different components and pages that
//will be used in the app
import Navigation from './components/navigation';
import BackToTop from './components/backToTop';
import Hero from './pages/hero';
import Services from './pages/services';
import CaseStudies from './pages/caseStudies';
import Testimonial from './pages/testimonial';
import Pricing from './pages/pricing';
import Faq from './pages/faq';
import About from './pages/about';
import Contact from './pages/contact';
import Footer from './components/footer';

// Content is read from the database on every request, so admin changes show straight away
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const settings = GetSiteSettings();
  return {
    ...pageMetadata({ title: settings.siteTitle, description: settings.siteDescription, path: "/" }),
    // The homepage uses the full title, not "<title> | <brand>"
    title: { absolute: `${settings.siteTitle} | ${settings.siteName}` },
  };
}

export default function Home() {
  const sections = GetSectionVisibility();
  const settings = GetSiteSettings();
  const caseStudies = ListCaseStudies({ publishedOnly: true, featuredOnly: true });

  return (
    <div className='bg-backgroundColour min-h-screen cursor-fancy'>
      <JsonLd data={homeSchema(settings, settings.siteDescription)} />
      <Navigation sections={sections} brand={settings.siteName} />
      <main>
        <Hero settings={settings} hasWork={sections.work && caseStudies.length > 0} />
        {sections.services && <Services items={GetContent('services')} industries={GetContent('industries')} />}
        {sections.work && <CaseStudies items={caseStudies} />}
        {sections.testimonials && <Testimonial items={GetContent('testimonials')} />}
        {sections.pricing && <Pricing settings={settings} />}
        <About settings={settings} />
        {sections.faq && <Faq items={GetContent('faqs')} />}
        <Contact email={settings.contactEmail} phone={settings.contactPhone} linkedin={settings.linkedinUrl} />
      </main>
      <Footer settings={settings} />
      <ToastContainer />
      <BackToTop />
    </div>
  );
}
