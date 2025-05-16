import { Switch, Route } from "wouter";
import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";
import CategoriesPage from "@/pages/CategoriesPage";
import RecentStudiesPage from "@/pages/RecentStudiesPage";
import CategoryPage from "@/pages/CategoryPage";
import StudyPage from "@/pages/StudyPage";
import ResourcePage from "@/pages/ResourcePage";
import ContactPage from "@/pages/ContactPage";
import NotFound from "@/pages/not-found";
import CookieBanner from "@/components/layout/CookieBanner";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

function App() {
  return (
    <>
      <CookieBanner />
      <Header />
      <main>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/categories" component={CategoriesPage} />
          <Route path="/recent" component={RecentStudiesPage} />
          <Route path="/category/:name" component={CategoryPage} />
          <Route path="/study/:id" component={StudyPage} />
          <Route path="/resources/:slug" component={ResourcePage} />
          <Route path="/contact" component={ContactPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </>
  );
}

export default App;
