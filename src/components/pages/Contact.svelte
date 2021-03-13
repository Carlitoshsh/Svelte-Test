<script>
  import { onMount } from "svelte";

  let pokemon_list;
  let pokemon_results = [];

  let columnNumber = 10;
  let offset = 0;

  import Pokecard from  './Contact/Pokecard.svelte';

  onMount(async () => {
    await loadPokemon()
  });

  async function loadPokemon(){
    pokemon_results = [];
    await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${columnNumber}&offset=${offset}`)
      .then((response) => response.json())
      .then((data) => {
        pokemon_list = data;
        recoverPokemon();
      });
  }

  function recoverPokemon() {
    Promise.all(pokemon_list.results.map((element) => 
      fetch(element.url)
        .then((response2) => response2.json())
        .then((data2) => {
            return data2;
        })
    )).then(data => {
        pokemon_results = data;
    });
  }

  async function nextPokemonGroup(){
    offset += columnNumber;
    await loadPokemon();
  }

  async function backPokemonGroup(){
    offset -= columnNumber;
    await loadPokemon();
  }

</script>



<h2>Pokemon page!</h2>

<div class="min-bar">
{#if offset > 0}
  <button on:click={backPokemonGroup}>Back</button>
{/if}
<input id="columnNumber" type=number bind:value={columnNumber} min="10" step="10" max="100" />
<button on:click={nextPokemonGroup}>Next</button>
</div>


<div class="pokemon-results">
  {#each pokemon_results as pokemon}
    <Pokecard pokemon={pokemon}/>
  {:else}
    <p>Loading...</p>
  {/each}
</div>



<style>
  .pokemon-results {
    display: grid;
    grid-gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .min-bar{
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    border-radius: 6px;
    border: 1px solid var(--text);
    display: flex;
    
  }

  #columnNumber{
    width: 3rem;
  }
</style>