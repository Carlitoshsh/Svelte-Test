<script>
  import Modal from "../../layout/Modal.svelte";

  export let pokemon;
  let pokemonSpecies;
  let default_image = "official-artwork";

  let showModal = false;

  function toggleShow() {
    default_image =
      default_image == "dream_world" ? "official-artwork" : "dream_world";
  }

  async function recoverSpeciesInfo() {
    await fetch(pokemon.species.url)
      .then((res) => res.json())
      .then((data) => {
        console.log("👨🏼‍🦰", data);
        pokemonSpecies = data;
      });
    showModal = true;
  }
</script>

{#if pokemon}
  <div
    class="pokemon"
    on:mouseenter={toggleShow}
    on:mouseleave={toggleShow}
    on:click={recoverSpeciesInfo}
  >
    <img
      src={pokemon.sprites.other[default_image]?.front_default}
      alt="image_{pokemon.name}"
    />
    <p class="p-card">{pokemon.name}</p>
  </div>
{/if}

{#if showModal}
  <!-- svelte-ignore missing-declaration -->
  <Modal on:close={() => (showModal = false)}>
    <h2 slot="header">
      {pokemonSpecies.names.find((x) => x.language.name == "en")
      .name}
      <span style="color:{pokemonSpecies.color.name}">
        <strong>#{pokemon.id}</strong>
      </span>
    </h2>
    <div slot="modal-body">
        <img
          src={pokemon.sprites.other[default_image]?.front_default}
          alt="image_{pokemon.name}"
          style="background-color: {pokemonSpecies.color.name};"
        />
    
        <p>
          {pokemonSpecies.flavor_text_entries.find((x) => x.language.name == "en")
            .flavor_text}
        </p>
    </div>

  </Modal>
{/if}

<style>
  .pokemon {
    justify-self: center;
  }

  .p-card {
    text-transform: capitalize;
    color: var(--light-back);
    text-align: center;
    font-weight: bold;
    background: var(--text);
    border-radius: 6px;
  }

  img {
    border-radius: 5px;
    max-width: 150px;
    height: 150px;
    background-color: var(--primary);
  }

  img:hover {
    cursor: pointer;
    background: var(--text);
  }
</style>
