
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
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
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
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
    function tick() {
        schedule_update();
        return resolved_promise;
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
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
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

    /* src/components/HelloWorld.svelte generated by Svelte v3.35.0 */

    function create_fragment$a(ctx) {
    	let h2;
    	let t1;
    	let p;

    	return {
    		c() {
    			h2 = element("h2");
    			h2.textContent = "Test";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Lorem ipsum dolor sit amet consectetur adipisicing elit. Architecto unde\n  mollitia neque maiores aspernatur consequuntur, repudiandae consequatur ipsam\n  eaque reprehenderit ducimus aut esse rem facere illum nihil ex, ipsa quaerat.\n  Beatae, ut mollitia facere, asperiores quo fuga suscipit aspernatur doloribus\n  doloremque officiis id! Sed, voluptatum culpa. Sed minima ipsum quod eligendi\n  culpa. Magnam qui quam voluptatum, id recusandae eos quisquam. Natus magni\n  repellat molestias consequatur doloremque, labore pariatur provident facere\n  fuga autem atque, eaque fugit officia nobis debitis necessitatibus iste\n  voluptatum tenetur dolor, alias consectetur modi beatae mollitia? Repudiandae,\n  recusandae. Iure voluptates aliquam omnis aperiam cumque molestias error quia\n  corrupti natus corporis quis fugit sequi, adipisci amet dignissimos eaque\n  quam, sapiente nisi? Doloremque ut obcaecati animi enim ipsum repudiandae\n  pariatur? Laboriosam possimus modi quasi et doloremque perspiciatis molestiae\n  fugiat cupiditate, dolores aspernatur, blanditiis molestias repudiandae, quis\n  assumenda! Molestiae iure adipisci in odio, vero quis quo minus quia impedit\n  minima eveniet. Ea accusantium maxime architecto rerum totam vitae atque\n  consequatur ducimus et! Impedit eligendi voluptatum voluptatibus tempore,\n  necessitatibus non nesciunt officiis sed facilis quam earum itaque architecto\n  distinctio repudiandae animi adipisci. Minima odit accusamus maiores molestias\n  saepe quae ab labore error sequi rerum, repellat distinctio mollitia, nemo\n  fugit quisquam facere voluptas ut libero assumenda dignissimos? Laudantium\n  voluptas corporis qui quibusdam doloremque. Eos tempora facere laborum ullam\n  molestiae quis minima aut. Odio, id eaque! Porro voluptates repellat corporis\n  at. Beatae fugiat ducimus saepe non quas dolorum, perspiciatis reprehenderit\n  animi eum minima ab. Ea iste in suscipit quam assumenda. Minus, animi. Modi\n  amet repellat, a porro aliquid quo explicabo adipisci, vitae, ut praesentium\n  expedita? Magnam officia ipsam, esse eius tempora possimus vero corporis?\n  Dolor inventore at nemo, nisi perferendis voluptatem temporibus illum\n  assumenda ea libero veritatis odit asperiores adipisci consequatur id\n  voluptatibus aperiam. Quod nam cum similique eligendi? Quisquam dolorum soluta\n  odit et! Sed totam sapiente id. Adipisci modi tempora repudiandae deserunt.\n  Dolor id inventore quam facilis ipsam adipisci aut magni aspernatur\n  dignissimos doloribus laboriosam, eos, rem corporis facere omnis explicabo\n  quisquam hic! Voluptatum aut est id, magnam sit in iste at deleniti porro\n  consequuntur exercitationem nihil nulla repudiandae doloremque incidunt! Quas\n  rerum commodi soluta earum labore excepturi, nemo at ratione sint minus!";
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
    		init(this, options, null, create_fragment$a, safe_not_equal, {});
    	}
    }

    /* src/components/layout/Header.svelte generated by Svelte v3.35.0 */

    function create_fragment$9(ctx) {
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

    function instance$5($$self, $$props, $$invalidate) {
    	let { name } = $$props;

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	return [name];
    }

    class Header extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$9, safe_not_equal, { name: 0 });
    	}
    }

    /* src/components/layout/Footer.svelte generated by Svelte v3.35.0 */

    function create_fragment$8(ctx) {
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
    		init(this, options, null, create_fragment$8, safe_not_equal, {});
    	}
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    function regexparam (str, loose) {
    	if (str instanceof RegExp) return { keys:false, pattern:str };
    	var c, o, tmp, ext, keys=[], pattern='', arr = str.split('/');
    	arr[0] || arr.shift();

    	while (tmp = arr.shift()) {
    		c = tmp[0];
    		if (c === '*') {
    			keys.push('wild');
    			pattern += '/(.*)';
    		} else if (c === ':') {
    			o = tmp.indexOf('?', 1);
    			ext = tmp.indexOf('.', 1);
    			keys.push( tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length) );
    			pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
    			if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    		} else {
    			pattern += '/' + tmp;
    		}
    	}

    	return {
    		keys: keys,
    		pattern: new RegExp('^' + pattern + (loose ? '(?=$|\/)' : '\/?$'), 'i')
    	};
    }

    /* node_modules/svelte-spa-router/Router.svelte generated by Svelte v3.35.0 */

    function create_else_block$1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return { props: switch_instance_props };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*props*/ 4)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    // (202:0) {#if componentParams}
    function create_if_block$2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [{ params: /*componentParams*/ ctx[1] }, /*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return { props: switch_instance_props };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*componentParams, props*/ 6)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*componentParams*/ 2 && { params: /*componentParams*/ ctx[1] },
    					dirty & /*props*/ 4 && get_spread_object(/*props*/ ctx[2])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$2, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*componentParams*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    /**
     * @typedef {Object} Location
     * @property {string} location - Location (page/view), for example `/book`
     * @property {string} [querystring] - Querystring from the hash, as a string not parsed
     */
    /**
     * Returns the current location from the hash.
     *
     * @returns {Location} Location object
     * @private
     */
    function getLocation() {
    	const hashPosition = window.location.href.indexOf("#/");

    	let location = hashPosition > -1
    	? window.location.href.substr(hashPosition + 1)
    	: "/";

    	// Check if there's a querystring
    	const qsPosition = location.indexOf("?");

    	let querystring = "";

    	if (qsPosition > -1) {
    		querystring = location.substr(qsPosition + 1);
    		location = location.substr(0, qsPosition);
    	}

    	return { location, querystring };
    }

    const loc = readable(null, // eslint-disable-next-line prefer-arrow-callback
    function start(set) {
    	set(getLocation());

    	const update = () => {
    		set(getLocation());
    	};

    	window.addEventListener("hashchange", update, false);

    	return function stop() {
    		window.removeEventListener("hashchange", update, false);
    	};
    });

    derived(loc, $loc => $loc.location);
    derived(loc, $loc => $loc.querystring);

    function link(node, hrefVar) {
    	// Only apply to <a> tags
    	if (!node || !node.tagName || node.tagName.toLowerCase() != "a") {
    		throw Error("Action \"link\" can only be used with <a> tags");
    	}

    	updateLink(node, hrefVar || node.getAttribute("href"));

    	return {
    		update(updated) {
    			updateLink(node, updated);
    		}
    	};
    }

    // Internal function used by the link function
    function updateLink(node, href) {
    	// Destination must start with '/'
    	if (!href || href.length < 1 || href.charAt(0) != "/") {
    		throw Error("Invalid value for \"href\" attribute: " + href);
    	}

    	// Add # to the href attribute
    	node.setAttribute("href", "#" + href);

    	node.addEventListener("click", scrollstateHistoryHandler);
    }

    /**
     * The handler attached to an anchor tag responsible for updating the
     * current history state with the current scroll state
     *
     * @param {HTMLElementEventMap} event - an onclick event attached to an anchor tag
     */
    function scrollstateHistoryHandler(event) {
    	// Prevent default anchor onclick behaviour
    	event.preventDefault();

    	const href = event.currentTarget.getAttribute("href");

    	// Setting the url (3rd arg) to href will break clicking for reasons, so don't try to do that
    	history.replaceState(
    		{
    			scrollX: window.scrollX,
    			scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	// This will force an update as desired, but this time our scroll state will be attached
    	window.location.hash = href;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { routes = {} } = $$props;
    	let { prefix = "" } = $$props;
    	let { restoreScrollState = false } = $$props;

    	/**
     * Container for a route: path, component
     */
    	class RouteItem {
    		/**
     * Initializes the object and creates a regular expression from the path, using regexparam.
     *
     * @param {string} path - Path to the route (must start with '/' or '*')
     * @param {SvelteComponent|WrappedComponent} component - Svelte component for the route, optionally wrapped
     */
    		constructor(path, component) {
    			if (!component || typeof component != "function" && (typeof component != "object" || component._sveltesparouter !== true)) {
    				throw Error("Invalid component object");
    			}

    			// Path must be a regular or expression, or a string starting with '/' or '*'
    			if (!path || typeof path == "string" && (path.length < 1 || path.charAt(0) != "/" && path.charAt(0) != "*") || typeof path == "object" && !(path instanceof RegExp)) {
    				throw Error("Invalid value for \"path\" argument - strings must start with / or *");
    			}

    			const { pattern, keys } = regexparam(path);
    			this.path = path;

    			// Check if the component is wrapped and we have conditions
    			if (typeof component == "object" && component._sveltesparouter === true) {
    				this.component = component.component;
    				this.conditions = component.conditions || [];
    				this.userData = component.userData;
    				this.props = component.props || {};
    			} else {
    				// Convert the component to a function that returns a Promise, to normalize it
    				this.component = () => Promise.resolve(component);

    				this.conditions = [];
    				this.props = {};
    			}

    			this._pattern = pattern;
    			this._keys = keys;
    		}

    		/**
     * Checks if `path` matches the current route.
     * If there's a match, will return the list of parameters from the URL (if any).
     * In case of no match, the method will return `null`.
     *
     * @param {string} path - Path to test
     * @returns {null|Object.<string, string>} List of paramters from the URL if there's a match, or `null` otherwise.
     */
    		match(path) {
    			// If there's a prefix, check if it matches the start of the path.
    			// If not, bail early, else remove it before we run the matching.
    			if (prefix) {
    				if (typeof prefix == "string") {
    					if (path.startsWith(prefix)) {
    						path = path.substr(prefix.length) || "/";
    					} else {
    						return null;
    					}
    				} else if (prefix instanceof RegExp) {
    					const match = path.match(prefix);

    					if (match && match[0]) {
    						path = path.substr(match[0].length) || "/";
    					} else {
    						return null;
    					}
    				}
    			}

    			// Check if the pattern matches
    			const matches = this._pattern.exec(path);

    			if (matches === null) {
    				return null;
    			}

    			// If the input was a regular expression, this._keys would be false, so return matches as is
    			if (this._keys === false) {
    				return matches;
    			}

    			const out = {};
    			let i = 0;

    			while (i < this._keys.length) {
    				// In the match parameters, URL-decode all values
    				try {
    					out[this._keys[i]] = decodeURIComponent(matches[i + 1] || "") || null;
    				} catch(e) {
    					out[this._keys[i]] = null;
    				}

    				i++;
    			}

    			return out;
    		}

    		/**
     * Dictionary with route details passed to the pre-conditions functions, as well as the `routeLoading`, `routeLoaded` and `conditionsFailed` events
     * @typedef {Object} RouteDetail
     * @property {string|RegExp} route - Route matched as defined in the route definition (could be a string or a reguar expression object)
     * @property {string} location - Location path
     * @property {string} querystring - Querystring from the hash
     * @property {object} [userData] - Custom data passed by the user
     * @property {SvelteComponent} [component] - Svelte component (only in `routeLoaded` events)
     * @property {string} [name] - Name of the Svelte component (only in `routeLoaded` events)
     */
    		/**
     * Executes all conditions (if any) to control whether the route can be shown. Conditions are executed in the order they are defined, and if a condition fails, the following ones aren't executed.
     * 
     * @param {RouteDetail} detail - Route detail
     * @returns {bool} Returns true if all the conditions succeeded
     */
    		async checkConditions(detail) {
    			for (let i = 0; i < this.conditions.length; i++) {
    				if (!await this.conditions[i](detail)) {
    					return false;
    				}
    			}

    			return true;
    		}
    	}

    	// Set up all routes
    	const routesList = [];

    	if (routes instanceof Map) {
    		// If it's a map, iterate on it right away
    		routes.forEach((route, path) => {
    			routesList.push(new RouteItem(path, route));
    		});
    	} else {
    		// We have an object, so iterate on its own properties
    		Object.keys(routes).forEach(path => {
    			routesList.push(new RouteItem(path, routes[path]));
    		});
    	}

    	// Props for the component to render
    	let component = null;

    	let componentParams = null;
    	let props = {};

    	// Event dispatcher from Svelte
    	const dispatch = createEventDispatcher();

    	// Just like dispatch, but executes on the next iteration of the event loop
    	async function dispatchNextTick(name, detail) {
    		// Execute this code when the current call stack is complete
    		await tick();

    		dispatch(name, detail);
    	}

    	// If this is set, then that means we have popped into this var the state of our last scroll position
    	let previousScrollState = null;

    	if (restoreScrollState) {
    		window.addEventListener("popstate", event => {
    			// If this event was from our history.replaceState, event.state will contain
    			// our scroll history. Otherwise, event.state will be null (like on forward
    			// navigation)
    			if (event.state && event.state.scrollY) {
    				previousScrollState = event.state;
    			} else {
    				previousScrollState = null;
    			}
    		});

    		afterUpdate(() => {
    			// If this exists, then this is a back navigation: restore the scroll position
    			if (previousScrollState) {
    				window.scrollTo(previousScrollState.scrollX, previousScrollState.scrollY);
    			} else {
    				// Otherwise this is a forward navigation: scroll to top
    				window.scrollTo(0, 0);
    			}
    		});
    	}

    	// Always have the latest value of loc
    	let lastLoc = null;

    	// Current object of the component loaded
    	let componentObj = null;

    	// Handle hash change events
    	// Listen to changes in the $loc store and update the page
    	// Do not use the $: syntax because it gets triggered by too many things
    	loc.subscribe(async newLoc => {
    		lastLoc = newLoc;

    		// Find a route matching the location
    		let i = 0;

    		while (i < routesList.length) {
    			const match = routesList[i].match(newLoc.location);

    			if (!match) {
    				i++;
    				continue;
    			}

    			const detail = {
    				route: routesList[i].path,
    				location: newLoc.location,
    				querystring: newLoc.querystring,
    				userData: routesList[i].userData
    			};

    			// Check if the route can be loaded - if all conditions succeed
    			if (!await routesList[i].checkConditions(detail)) {
    				// Don't display anything
    				$$invalidate(0, component = null);

    				componentObj = null;

    				// Trigger an event to notify the user, then exit
    				dispatchNextTick("conditionsFailed", detail);

    				return;
    			}

    			// Trigger an event to alert that we're loading the route
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick("routeLoading", Object.assign({}, detail));

    			// If there's a component to show while we're loading the route, display it
    			const obj = routesList[i].component;

    			// Do not replace the component if we're loading the same one as before, to avoid the route being unmounted and re-mounted
    			if (componentObj != obj) {
    				if (obj.loading) {
    					$$invalidate(0, component = obj.loading);
    					componentObj = obj;
    					$$invalidate(1, componentParams = obj.loadingParams);
    					$$invalidate(2, props = {});

    					// Trigger the routeLoaded event for the loading component
    					// Create a copy of detail so we don't modify the object for the dynamic route (and the dynamic route doesn't modify our object too)
    					dispatchNextTick("routeLoaded", Object.assign({}, detail, { component, name: component.name }));
    				} else {
    					$$invalidate(0, component = null);
    					componentObj = null;
    				}

    				// Invoke the Promise
    				const loaded = await obj();

    				// Now that we're here, after the promise resolved, check if we still want this component, as the user might have navigated to another page in the meanwhile
    				if (newLoc != lastLoc) {
    					// Don't update the component, just exit
    					return;
    				}

    				// If there is a "default" property, which is used by async routes, then pick that
    				$$invalidate(0, component = loaded && loaded.default || loaded);

    				componentObj = obj;
    			}

    			// Set componentParams only if we have a match, to avoid a warning similar to `<Component> was created with unknown prop 'params'`
    			// Of course, this assumes that developers always add a "params" prop when they are expecting parameters
    			if (match && typeof match == "object" && Object.keys(match).length) {
    				$$invalidate(1, componentParams = match);
    			} else {
    				$$invalidate(1, componentParams = null);
    			}

    			// Set static props, if any
    			$$invalidate(2, props = routesList[i].props);

    			// Dispatch the routeLoaded event then exit
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick("routeLoaded", Object.assign({}, detail, { component, name: component.name }));

    			return;
    		}

    		// If we're still here, there was no match, so show the empty component
    		$$invalidate(0, component = null);

    		componentObj = null;
    	});

    	function routeEvent_handler(event) {
    		bubble($$self, event);
    	}

    	function routeEvent_handler_1(event) {
    		bubble($$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ("routes" in $$props) $$invalidate(3, routes = $$props.routes);
    		if ("prefix" in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ("restoreScrollState" in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*restoreScrollState*/ 32) {
    			// Update history.scrollRestoration depending on restoreScrollState
    			history.scrollRestoration = restoreScrollState ? "manual" : "auto";
    		}
    	};

    	return [
    		component,
    		componentParams,
    		props,
    		routes,
    		prefix,
    		restoreScrollState,
    		routeEvent_handler,
    		routeEvent_handler_1
    	];
    }

    class Router extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$4, create_fragment$7, safe_not_equal, {
    			routes: 3,
    			prefix: 4,
    			restoreScrollState: 5
    		});
    	}
    }

    // List of nodes to update
    const nodes = [];

    // Current location
    let location;

    // Function that updates all nodes marking the active ones
    function checkActive(el) {
        const matchesLocation = el.pattern.test(location);
        toggleClasses(el, el.className, matchesLocation);
        toggleClasses(el, el.inactiveClassName, !matchesLocation);
    }

    function toggleClasses(el, className, shouldAdd) {
        (className || '').split(' ').forEach((cls) => {
            if (!cls) {
                return
            }
            // Remove the class firsts
            el.node.classList.remove(cls);

            // If the pattern doesn't match, then set the class
            if (shouldAdd) {
                el.node.classList.add(cls);
            }
        });
    }

    // Listen to changes in the location
    loc.subscribe((value) => {
        // Update the location
        location = value.location + (value.querystring ? '?' + value.querystring : '');

        // Update all nodes
        nodes.map(checkActive);
    });

    /**
     * @typedef {Object} ActiveOptions
     * @property {string|RegExp} [path] - Path expression that makes the link active when matched (must start with '/' or '*'); default is the link's href
     * @property {string} [className] - CSS class to apply to the element when active; default value is "active"
     */

    /**
     * Svelte Action for automatically adding the "active" class to elements (links, or any other DOM element) when the current location matches a certain path.
     * 
     * @param {HTMLElement} node - The target node (automatically set by Svelte)
     * @param {ActiveOptions|string|RegExp} [opts] - Can be an object of type ActiveOptions, or a string (or regular expressions) representing ActiveOptions.path.
     * @returns {{destroy: function(): void}} Destroy function
     */
    function active(node, opts) {
        // Check options
        if (opts && (typeof opts == 'string' || (typeof opts == 'object' && opts instanceof RegExp))) {
            // Interpret strings and regular expressions as opts.path
            opts = {
                path: opts
            };
        }
        else {
            // Ensure opts is a dictionary
            opts = opts || {};
        }

        // Path defaults to link target
        if (!opts.path && node.hasAttribute('href')) {
            opts.path = node.getAttribute('href');
            if (opts.path && opts.path.length > 1 && opts.path.charAt(0) == '#') {
                opts.path = opts.path.substring(1);
            }
        }

        // Default class name
        if (!opts.className) {
            opts.className = 'active';
        }

        // If path is a string, it must start with '/' or '*'
        if (!opts.path || 
            typeof opts.path == 'string' && (opts.path.length < 1 || (opts.path.charAt(0) != '/' && opts.path.charAt(0) != '*'))
        ) {
            throw Error('Invalid value for "path" argument')
        }

        // If path is not a regular expression already, make it
        const {pattern} = typeof opts.path == 'string' ?
            regexparam(opts.path) :
            {pattern: opts.path};

        // Add the node to the list
        const el = {
            node,
            className: opts.className,
            inactiveClassName: opts.inactiveClassName,
            pattern
        };
        nodes.push(el);

        // Trigger the action right away
        checkActive(el);

        return {
            // When the element is destroyed, remove it from the list
            destroy() {
                nodes.splice(nodes.indexOf(el), 1);
            }
        }
    }

    /* src/components/layout/Nav.svelte generated by Svelte v3.35.0 */

    function create_fragment$6(ctx) {
    	let div1;
    	let div0;
    	let a0;
    	let t1;
    	let a1;
    	let t3;
    	let a2;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			a0.textContent = "Home";
    			t1 = space();
    			a1 = element("a");
    			a1.textContent = "Pokemon API";
    			t3 = space();
    			a2 = element("a");
    			a2.textContent = "About";
    			attr(a0, "href", "/");
    			attr(a0, "class", "svelte-fnrhzw");
    			attr(a1, "href", "/pokemon");
    			attr(a1, "class", "svelte-fnrhzw");
    			attr(a2, "href", "/about");
    			attr(a2, "class", "svelte-fnrhzw");
    			attr(div0, "class", "my-nav svelte-fnrhzw");
    			attr(div1, "class", "my-nav-container svelte-fnrhzw");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, a0);
    			append(div0, t1);
    			append(div0, a1);
    			append(div0, t3);
    			append(div0, a2);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(link.call(null, a0)),
    					action_destroyer(active.call(null, a0)),
    					action_destroyer(link.call(null, a1)),
    					action_destroyer(active.call(null, a1)),
    					action_destroyer(link.call(null, a2)),
    					action_destroyer(active.call(null, a2))
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    class Nav extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$6, safe_not_equal, {});
    	}
    }

    /* src/components/layout/Modal.svelte generated by Svelte v3.35.0 */
    const get_header_slot_changes = dirty => ({});
    const get_header_slot_context = ctx => ({});

    function create_fragment$5(ctx) {
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let hr0;
    	let t2;
    	let t3;
    	let hr1;
    	let t4;
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const header_slot_template = /*#slots*/ ctx[4].header;
    	const header_slot = create_slot(header_slot_template, ctx, /*$$scope*/ ctx[3], get_header_slot_context);
    	const default_slot_template = /*#slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

    	return {
    		c() {
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			if (header_slot) header_slot.c();
    			t1 = space();
    			hr0 = element("hr");
    			t2 = space();
    			if (default_slot) default_slot.c();
    			t3 = space();
    			hr1 = element("hr");
    			t4 = space();
    			button = element("button");
    			button.textContent = "close modal";
    			attr(div0, "class", "modal-background svelte-1k3utew");
    			button.autofocus = true;
    			attr(button, "class", "svelte-1k3utew");
    			attr(div1, "class", "modal svelte-1k3utew");
    			attr(div1, "role", "dialog");
    			attr(div1, "aria-modal", "true");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);

    			if (header_slot) {
    				header_slot.m(div1, null);
    			}

    			append(div1, t1);
    			append(div1, hr0);
    			append(div1, t2);

    			if (default_slot) {
    				default_slot.m(div1, null);
    			}

    			append(div1, t3);
    			append(div1, hr1);
    			append(div1, t4);
    			append(div1, button);
    			/*div1_binding*/ ctx[5](div1);
    			current = true;
    			button.focus();

    			if (!mounted) {
    				dispose = [
    					listen(window, "keydown", /*handle_keydown*/ ctx[2]),
    					listen(div0, "click", /*close*/ ctx[1]),
    					listen(button, "click", /*close*/ ctx[1])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (header_slot) {
    				if (header_slot.p && dirty & /*$$scope*/ 8) {
    					update_slot(header_slot, header_slot_template, ctx, /*$$scope*/ ctx[3], dirty, get_header_slot_changes, get_header_slot_context);
    				}
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 8) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], dirty, null, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(header_slot, local);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(header_slot, local);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t0);
    			if (detaching) detach(div1);
    			if (header_slot) header_slot.d(detaching);
    			if (default_slot) default_slot.d(detaching);
    			/*div1_binding*/ ctx[5](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	const dispatch = createEventDispatcher();
    	const close = () => dispatch("close");
    	let modal;

    	const handle_keydown = e => {
    		if (e.key === "Escape") {
    			close();
    			return;
    		}

    		if (e.key === "Tab") {
    			// trap focus
    			const nodes = modal.querySelectorAll("*");

    			const tabbable = Array.from(nodes).filter(n => n.tabIndex >= 0);
    			let index = tabbable.indexOf(document.activeElement);
    			if (index === -1 && e.shiftKey) index = 0;
    			index += tabbable.length + (e.shiftKey ? -1 : 1);
    			index %= tabbable.length;
    			tabbable[index].focus();
    			e.preventDefault();
    		}
    	};

    	const previously_focused = typeof document !== "undefined" && document.activeElement;

    	if (previously_focused) {
    		onDestroy(() => {
    			previously_focused.focus();
    		});
    	}

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			modal = $$value;
    			$$invalidate(0, modal);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	return [modal, close, handle_keydown, $$scope, slots, div1_binding];
    }

    class Modal extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$5, safe_not_equal, {});
    	}
    }

    /* src/components/pages/Pokemon/Pokecard.svelte generated by Svelte v3.35.0 */

    function create_if_block_1(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let p;
    	let t1_value = /*pokemon*/ ctx[0].name + "";
    	let t1;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			img = element("img");
    			t0 = space();
    			p = element("p");
    			t1 = text(t1_value);
    			if (img.src !== (img_src_value = /*pokemon*/ ctx[0].sprites.other[/*default_image*/ ctx[1]]?.front_default)) attr(img, "src", img_src_value);
    			attr(img, "alt", img_alt_value = "image_" + /*pokemon*/ ctx[0].name);
    			attr(img, "class", "svelte-27c2c9");
    			attr(p, "class", "svelte-27c2c9");
    			attr(div, "class", "pokemon svelte-27c2c9");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, img);
    			append(div, t0);
    			append(div, p);
    			append(p, t1);

    			if (!mounted) {
    				dispose = [
    					listen(div, "mouseenter", /*toggleShow*/ ctx[3]),
    					listen(div, "mouseleave", /*toggleShow*/ ctx[3]),
    					listen(div, "click", /*click_handler*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*pokemon, default_image*/ 3 && img.src !== (img_src_value = /*pokemon*/ ctx[0].sprites.other[/*default_image*/ ctx[1]]?.front_default)) {
    				attr(img, "src", img_src_value);
    			}

    			if (dirty & /*pokemon*/ 1 && img_alt_value !== (img_alt_value = "image_" + /*pokemon*/ ctx[0].name)) {
    				attr(img, "alt", img_alt_value);
    			}

    			if (dirty & /*pokemon*/ 1 && t1_value !== (t1_value = /*pokemon*/ ctx[0].name + "")) set_data(t1, t1_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (30:0) {#if showModal}
    function create_if_block$1(ctx) {
    	let modal;
    	let current;

    	modal = new Modal({
    			props: {
    				$$slots: {
    					header: [create_header_slot],
    					default: [create_default_slot]
    				},
    				$$scope: { ctx }
    			}
    		});

    	modal.$on("close", /*close_handler*/ ctx[5]);

    	return {
    		c() {
    			create_component(modal.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(modal, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const modal_changes = {};

    			if (dirty & /*$$scope, pokemon, default_image*/ 67) {
    				modal_changes.$$scope = { dirty, ctx };
    			}

    			modal.$set(modal_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(modal.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(modal.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(modal, detaching);
    		}
    	};
    }

    // (32:1) <Modal on:close="{() => showModal = false}">
    function create_default_slot(ctx) {
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let ol;
    	let t12;
    	let a;

    	return {
    		c() {
    			img = element("img");
    			t0 = space();
    			ol = element("ol");

    			ol.innerHTML = `<li>of or relating to modality in logic</li> 
			<li>containing provisions as to the mode of procedure or the manner of taking effect —used of a contract or legacy</li> 
			<li>of or relating to a musical mode</li> 
			<li>of or relating to structure as opposed to substance</li> 
			<li>of, relating to, or constituting a grammatical form or category characteristically indicating predication</li> 
			<li>of or relating to a statistical mode</li>`;

    			t12 = space();
    			a = element("a");
    			a.textContent = "merriam-webster.com";
    			if (img.src !== (img_src_value = /*pokemon*/ ctx[0].sprites.other[/*default_image*/ ctx[1]]?.front_default)) attr(img, "src", img_src_value);
    			attr(img, "alt", img_alt_value = "image_" + /*pokemon*/ ctx[0].name);
    			attr(img, "class", "svelte-27c2c9");
    			attr(ol, "class", "definition-list");
    			attr(a, "href", "https://www.merriam-webster.com/dictionary/modal");
    		},
    		m(target, anchor) {
    			insert(target, img, anchor);
    			insert(target, t0, anchor);
    			insert(target, ol, anchor);
    			insert(target, t12, anchor);
    			insert(target, a, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*pokemon, default_image*/ 3 && img.src !== (img_src_value = /*pokemon*/ ctx[0].sprites.other[/*default_image*/ ctx[1]]?.front_default)) {
    				attr(img, "src", img_src_value);
    			}

    			if (dirty & /*pokemon*/ 1 && img_alt_value !== (img_alt_value = "image_" + /*pokemon*/ ctx[0].name)) {
    				attr(img, "alt", img_alt_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(img);
    			if (detaching) detach(t0);
    			if (detaching) detach(ol);
    			if (detaching) detach(t12);
    			if (detaching) detach(a);
    		}
    	};
    }

    // (33:2) 
    function create_header_slot(ctx) {
    	let h2;

    	return {
    		c() {
    			h2 = element("h2");

    			h2.innerHTML = `modal
			<small><em>adjective</em>  mod·al \\ˈmō-dəl\\</small>`;

    			attr(h2, "slot", "header");
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h2);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let t;
    	let if_block1_anchor;
    	let current;
    	let if_block0 = /*pokemon*/ ctx[0] && create_if_block_1(ctx);
    	let if_block1 = /*showModal*/ ctx[2] && create_if_block$1(ctx);

    	return {
    		c() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*pokemon*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*showModal*/ ctx[2]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*showModal*/ 4) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { pokemon } = $$props;
    	let default_image = "official-artwork";
    	let showModal = false;

    	function toggleShow() {
    		$$invalidate(1, default_image = default_image == "dream_world"
    		? "official-artwork"
    		: "dream_world");
    	}

    	const click_handler = () => $$invalidate(2, showModal = true);
    	const close_handler = () => $$invalidate(2, showModal = false);

    	$$self.$$set = $$props => {
    		if ("pokemon" in $$props) $$invalidate(0, pokemon = $$props.pokemon);
    	};

    	return [pokemon, default_image, showModal, toggleShow, click_handler, close_handler];
    }

    class Pokecard extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$4, safe_not_equal, { pokemon: 0 });
    	}
    }

    /* src/components/pages/Pokemon/Pokemon.svelte generated by Svelte v3.35.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (55:0) {#if offset > 0}
    function create_if_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "Back";
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*backPokemonGroup*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (66:2) {:else}
    function create_else_block(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "Loading...";
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (64:2) {#each pokemon_results as pokemon}
    function create_each_block(ctx) {
    	let pokecard;
    	let current;
    	pokecard = new Pokecard({ props: { pokemon: /*pokemon*/ ctx[9] } });

    	return {
    		c() {
    			create_component(pokecard.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(pokecard, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const pokecard_changes = {};
    			if (dirty & /*pokemon_results*/ 1) pokecard_changes.pokemon = /*pokemon*/ ctx[9];
    			pokecard.$set(pokecard_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(pokecard.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(pokecard.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(pokecard, detaching);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let h2;
    	let t1;
    	let div0;
    	let t2;
    	let input;
    	let t3;
    	let button;
    	let t5;
    	let div1;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*offset*/ ctx[2] > 0 && create_if_block(ctx);
    	let each_value = /*pokemon_results*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block();
    	}

    	return {
    		c() {
    			h2 = element("h2");
    			h2.textContent = "Pokemon page!";
    			t1 = space();
    			div0 = element("div");
    			if (if_block) if_block.c();
    			t2 = space();
    			input = element("input");
    			t3 = space();
    			button = element("button");
    			button.textContent = "Next";
    			t5 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			attr(input, "id", "columnNumber");
    			attr(input, "type", "number");
    			attr(input, "min", "10");
    			attr(input, "step", "10");
    			attr(input, "max", "100");
    			attr(input, "class", "svelte-1lkiulq");
    			attr(div0, "class", "min-bar svelte-1lkiulq");
    			attr(div1, "class", "pokemon-results svelte-1lkiulq");
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			insert(target, t1, anchor);
    			insert(target, div0, anchor);
    			if (if_block) if_block.m(div0, null);
    			append(div0, t2);
    			append(div0, input);
    			set_input_value(input, /*columnNumber*/ ctx[1]);
    			append(div0, t3);
    			append(div0, button);
    			insert(target, t5, anchor);
    			insert(target, div1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(div1, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[5]),
    					listen(button, "click", /*nextPokemonGroup*/ ctx[3])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (/*offset*/ ctx[2] > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div0, t2);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*columnNumber*/ 2 && to_number(input.value) !== /*columnNumber*/ ctx[1]) {
    				set_input_value(input, /*columnNumber*/ ctx[1]);
    			}

    			if (dirty & /*pokemon_results*/ 1) {
    				each_value = /*pokemon_results*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();

    				if (each_value.length) {
    					if (each_1_else) {
    						each_1_else.d(1);
    						each_1_else = null;
    					}
    				} else if (!each_1_else) {
    					each_1_else = create_else_block();
    					each_1_else.c();
    					each_1_else.m(div1, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t1);
    			if (detaching) detach(div0);
    			if (if_block) if_block.d();
    			if (detaching) detach(t5);
    			if (detaching) detach(div1);
    			destroy_each(each_blocks, detaching);
    			if (each_1_else) each_1_else.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let pokemon_list;
    	let pokemon_results = [];
    	let columnNumber = 10;
    	let offset = 0;

    	onMount(async () => {
    		await loadPokemon();
    	});

    	async function loadPokemon() {
    		$$invalidate(0, pokemon_results = []);

    		await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${columnNumber}&offset=${offset}`).then(response => response.json()).then(data => {
    			pokemon_list = data;
    			recoverPokemon();
    		});
    	}

    	function recoverPokemon() {
    		Promise.all(pokemon_list.results.map(element => fetch(element.url).then(response2 => response2.json()).then(data2 => {
    			return data2;
    		}))).then(data => {
    			$$invalidate(0, pokemon_results = data);
    		});
    	}

    	async function nextPokemonGroup() {
    		$$invalidate(2, offset += columnNumber);
    		await loadPokemon();
    	}

    	async function backPokemonGroup() {
    		$$invalidate(2, offset -= columnNumber);
    		await loadPokemon();
    	}

    	function input_input_handler() {
    		columnNumber = to_number(this.value);
    		$$invalidate(1, columnNumber);
    	}

    	return [
    		pokemon_results,
    		columnNumber,
    		offset,
    		nextPokemonGroup,
    		backPokemonGroup,
    		input_input_handler
    	];
    }

    class Pokemon extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/components/pages/About.svelte generated by Svelte v3.35.0 */

    function create_fragment$2(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "About Page";
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

    class About extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src/components/pages/NotFound.svelte generated by Svelte v3.35.0 */

    function create_fragment$1(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "404 not found!";
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

    class NotFound extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.35.0 */

    function create_fragment(ctx) {
    	let div;
    	let header1;
    	let header0;
    	let t0;
    	let nav;
    	let t1;
    	let main;
    	let router;
    	let t2;
    	let footer1;
    	let footer0;
    	let current;
    	header0 = new Header({ props: { name: /*name*/ ctx[0] } });
    	nav = new Nav({});
    	router = new Router({ props: { routes: /*routes*/ ctx[1] } });
    	footer0 = new Footer({});

    	return {
    		c() {
    			div = element("div");
    			header1 = element("header");
    			create_component(header0.$$.fragment);
    			t0 = space();
    			create_component(nav.$$.fragment);
    			t1 = space();
    			main = element("main");
    			create_component(router.$$.fragment);
    			t2 = space();
    			footer1 = element("footer");
    			create_component(footer0.$$.fragment);
    			attr(header1, "class", "pink section");
    			attr(main, "class", "section coral svelte-49fgjk");
    			attr(footer1, "class", "green section");
    			attr(div, "class", "parent");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, header1);
    			mount_component(header0, header1, null);
    			append(header1, t0);
    			mount_component(nav, header1, null);
    			append(div, t1);
    			append(div, main);
    			mount_component(router, main, null);
    			append(div, t2);
    			append(div, footer1);
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
    			transition_in(nav.$$.fragment, local);
    			transition_in(router.$$.fragment, local);
    			transition_in(footer0.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(header0.$$.fragment, local);
    			transition_out(nav.$$.fragment, local);
    			transition_out(router.$$.fragment, local);
    			transition_out(footer0.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(header0);
    			destroy_component(nav);
    			destroy_component(router);
    			destroy_component(footer0);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	const routes = {
    		// Exact path
    		"/": HelloWorld,
    		// Using named parameters, with last being optional
    		"/pokemon": Pokemon,
    		// Wildcard parameter
    		"/about": About,
    		// Catch-all
    		// This is optional, but if present it must be the last
    		"*": NotFound
    	};

    	let { name } = $$props;

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	return [name, routes];
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
        name: 'svelte-app',
      },
    });

    return app;

}());
