<script>
  import { onMount } from "svelte";

  let pokemon_list;
  let pokemon_results = [];
  let pokemon_loaded = false;

  onMount(async () => {
    await fetch("https://pokeapi.co/api/v2/pokemon?limit=10&offset=0")
      .then((response) => response.json())
      .then((data) => {
        pokemon_list = data;
        recoverPokemon();
      });
  });

  function recoverPokemon() {
    pokemon_list.results.forEach((element) => {
      fetch(element.url)
        .then((response2) => response2.json())
        .then((data2) => {
          pokemon_results.push(data2);
          console.log(pokemon_results);
          pokemon_loaded = true;
        });
    });
  }
</script>

<p>Contact page!</p>

{#if pokemon_loaded}
  {#each pokemon_results as pokemon}
    <p>{pokemon.name}</p>
    <img
      src={pokemon.sprites.other["official-artwork"].front_default}
      alt="image_{pokemon.name}"
    />
  {:else}
    <p>Loading...</p>
  {/each}
{/if}
