
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\components\HelloWorld.svelte generated by Svelte v3.35.0 */

    function create_fragment$3(ctx) {
    	let h2;
    	let t1;
    	let p;

    	return {
    		c() {
    			h2 = element("h2");
    			h2.textContent = "Test";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Lorem ipsum dolor sit amet consectetur adipisicing elit. Architecto unde\r\n  mollitia neque maiores aspernatur consequuntur, repudiandae consequatur ipsam\r\n  eaque reprehenderit ducimus aut esse rem facere illum nihil ex, ipsa quaerat.\r\n  Beatae, ut mollitia facere, asperiores quo fuga suscipit aspernatur doloribus\r\n  doloremque officiis id! Sed, voluptatum culpa. Sed minima ipsum quod eligendi\r\n  culpa. Magnam qui quam voluptatum, id recusandae eos quisquam. Natus magni\r\n  repellat molestias consequatur doloremque, labore pariatur provident facere\r\n  fuga autem atque, eaque fugit officia nobis debitis necessitatibus iste\r\n  voluptatum tenetur dolor, alias consectetur modi beatae mollitia? Repudiandae,\r\n  recusandae. Iure voluptates aliquam omnis aperiam cumque molestias error quia\r\n  corrupti natus corporis quis fugit sequi, adipisci amet dignissimos eaque\r\n  quam, sapiente nisi? Doloremque ut obcaecati animi enim ipsum repudiandae\r\n  pariatur? Laboriosam possimus modi quasi et doloremque perspiciatis molestiae\r\n  fugiat cupiditate, dolores aspernatur, blanditiis molestias repudiandae, quis\r\n  assumenda! Molestiae iure adipisci in odio, vero quis quo minus quia impedit\r\n  minima eveniet. Ea accusantium maxime architecto rerum totam vitae atque\r\n  consequatur ducimus et! Impedit eligendi voluptatum voluptatibus tempore,\r\n  necessitatibus non nesciunt officiis sed facilis quam earum itaque architecto\r\n  distinctio repudiandae animi adipisci. Minima odit accusamus maiores molestias\r\n  saepe quae ab labore error sequi rerum, repellat distinctio mollitia, nemo\r\n  fugit quisquam facere voluptas ut libero assumenda dignissimos? Laudantium\r\n  voluptas corporis qui quibusdam doloremque. Eos tempora facere laborum ullam\r\n  molestiae quis minima aut. Odio, id eaque! Porro voluptates repellat corporis\r\n  at. Beatae fugiat ducimus saepe non quas dolorum, perspiciatis reprehenderit\r\n  animi eum minima ab. Ea iste in suscipit quam assumenda. Minus, animi. Modi\r\n  amet repellat, a porro aliquid quo explicabo adipisci, vitae, ut praesentium\r\n  expedita? Magnam officia ipsam, esse eius tempora possimus vero corporis?\r\n  Dolor inventore at nemo, nisi perferendis voluptatem temporibus illum\r\n  assumenda ea libero veritatis odit asperiores adipisci consequatur id\r\n  voluptatibus aperiam. Quod nam cum similique eligendi? Quisquam dolorum soluta\r\n  odit et! Sed totam sapiente id. Adipisci modi tempora repudiandae deserunt.\r\n  Dolor id inventore quam facilis ipsam adipisci aut magni aspernatur\r\n  dignissimos doloribus laboriosam, eos, rem corporis facere omnis explicabo\r\n  quisquam hic! Voluptatum aut est id, magnam sit in iste at deleniti porro\r\n  consequuntur exercitationem nihil nulla repudiandae doloremque incidunt! Quas\r\n  rerum commodi soluta earum labore excepturi, nemo at ratione sint minus!";
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			insert(target, t1, anchor);
    			insert(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t1);
    			if (detaching) detach(p);
    		}
    	};
    }

    class HelloWorld extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src\components\layout\Header.svelte generated by Svelte v3.35.0 */

    function create_fragment$2(ctx) {
    	let h3;
    	let strong;
    	let t;

    	return {
    		c() {
    			h3 = element("h3");
    			strong = element("strong");
    			t = text(/*name*/ ctx[0]);
    			attr(h3, "class", "svelte-1mus3rg");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			append(h3, strong);
    			append(strong, t);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data(t, /*name*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h3);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { name } = $$props;

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	return [name];
    }

    class Header extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, { name: 0 });
    	}
    }

    /* src\components\layout\Footer.svelte generated by Svelte v3.35.0 */

    function create_fragment$1(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "This is just a test!";
    			attr(p, "class", "svelte-cws3fn");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    class Footer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src\App.svelte generated by Svelte v3.35.0 */

    function create_fragment(ctx) {
    	let div2;
    	let header1;
    	let header0;
    	let t0;
    	let div0;
    	let t1;
    	let main;
    	let helloworld;
    	let t2;
    	let div1;
    	let t3;
    	let footer1;
    	let footer0;
    	let current;
    	header0 = new Header({ props: { name: /*name*/ ctx[0] } });
    	helloworld = new HelloWorld({});
    	footer0 = new Footer({});

    	return {
    		c() {
    			div2 = element("div");
    			header1 = element("header");
    			create_component(header0.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			t1 = space();
    			main = element("main");
    			create_component(helloworld.$$.fragment);
    			t2 = space();
    			div1 = element("div");
    			t3 = space();
    			footer1 = element("footer");
    			create_component(footer0.$$.fragment);
    			attr(header1, "class", "pink section");
    			attr(div0, "class", "left-side blue section");
    			attr(main, "class", "section coral");
    			attr(div1, "class", "right-side yellow section");
    			attr(footer1, "class", "green section");
    			attr(div2, "class", "parent");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, header1);
    			mount_component(header0, header1, null);
    			append(div2, t0);
    			append(div2, div0);
    			append(div2, t1);
    			append(div2, main);
    			mount_component(helloworld, main, null);
    			append(div2, t2);
    			append(div2, div1);
    			append(div2, t3);
    			append(div2, footer1);
    			mount_component(footer0, footer1, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const header0_changes = {};
    			if (dirty & /*name*/ 1) header0_changes.name = /*name*/ ctx[0];
    			header0.$set(header0_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(header0.$$.fragment, local);
    			transition_in(helloworld.$$.fragment, local);
    			transition_in(footer0.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(header0.$$.fragment, local);
    			transition_out(helloworld.$$.fragment, local);
    			transition_out(footer0.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div2);
    			destroy_component(header0);
    			destroy_component(helloworld);
    			destroy_component(footer0);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {

    	let { name } = $$props;

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	return [name];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });
    	}
    }

    const app = new App({
      target: document.body,
      props: {
        name: 'Carlos',
      },
    });

    return app;

}());
