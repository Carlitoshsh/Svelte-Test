<script>
import Modal from "../../layout/Modal.svelte";


    export let pokemon;
    let default_image = "official-artwork";

let showModal = false;


    function toggleShow(){
        default_image = default_image == "dream_world" ?  "official-artwork" :"dream_world" ;
    }
</script>

{#if pokemon}
    <div class="pokemon"
            on:mouseenter={toggleShow}
	        on:mouseleave={toggleShow}
            on:click="{() => showModal = true}">
        <img
            src={pokemon.sprites.other[default_image]?.front_default}
            alt="image_{pokemon.name}"
        />
        <p>{pokemon.name}</p>
    </div>
{/if}


{#if showModal}
	<!-- svelte-ignore missing-declaration -->
	<Modal on:close="{() => showModal = false}">
		<h2 slot="header">
			modal
			<small><em>adjective</em>  mod·al \ˈmō-dəl\</small>
		</h2>
        <img
            src={pokemon.sprites.other[default_image]?.front_default}
            alt="image_{pokemon.name}"
        />


		<ol class="definition-list">
			<li>of or relating to modality in logic</li>
			<li>containing provisions as to the mode of procedure or the manner of taking effect —used of a contract or legacy</li>
			<li>of or relating to a musical mode</li>
			<li>of or relating to structure as opposed to substance</li>
			<li>of, relating to, or constituting a grammatical form or category characteristically indicating predication</li>
			<li>of or relating to a statistical mode</li>
		</ol>

		<a href="https://www.merriam-webster.com/dictionary/modal">merriam-webster.com</a>
	</Modal>
{/if}

<style>
    .pokemon {
        justify-self: center;
    }

    p {
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

    img:hover{
        cursor: pointer;
        background: var(--text);
    }
</style>
