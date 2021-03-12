<script>
  import HelloWorld from "./components/HelloWorld.svelte";
  import Header from "./components/layout/Header.svelte";
  import Footer from "./components/layout/Footer.svelte";

  // import Router from 'svelte-spa-router';
  import Contact from "./components/pages/Contact.svelte";
  import About from "./components/pages/About.svelte";
  import NotFound from "./components/pages/NotFound.svelte";

  const routes = {
    // Exact path
    "/": HelloWorld,

    // Using named parameters, with last being optional
    "/contact": Contact,

    // Wildcard parameter
    "/about": About,

    // Catch-all
    // This is optional, but if present it must be the last
    "*": NotFound,
  };
  export let name;
</script>

<div class="parent">
  <header class="pink section">
    <Header {name} />
  </header>
  <div class="left-side blue section" />
  <main class="section coral">
    <HelloWorld />
  </main>
  <div class="right-side yellow section" />
  <footer class="green section">
    <Footer />
  </footer>
</div>
