/* Steve jobs' book */

// --- Cassie custom interactive pages helpers ---
// Load an external script once (returns a Promise).
window.__cassieLoadedScripts = window.__cassieLoadedScripts || {};
function cassieEnsureScript(src) {
	return new Promise(function(resolve, reject) {
		if (!src) return resolve();
		if (window.__cassieLoadedScripts[src]) return resolve();

		var el = document.createElement('script');
		el.src = src;
		el.async = false;
		el.onload = function() {
			window.__cassieLoadedScripts[src] = true;
			resolve();
		};
		el.onerror = function() {
			reject(new Error('Failed to load script: ' + src));
		};
		document.head.appendChild(el);
	});
}

// Global gate flag for page 11.
window.__page11Unlocked = window.__page11Unlocked === true;

// Global state for page 8/9 flow.
window.__page8Answered = window.__page8Answered === true;
window.__page9Revealed = window.__page9Revealed === true;
window.__page9Answered = window.__page9Answered === true;

// Fade-swap helper (re-usable; animates opacity instead of src).
window.fadeSwapImage = function(imgEl, newSrc, cb) {
	try {
		if (!imgEl || !newSrc) return;
		imgEl.style.opacity = imgEl.style.opacity || '1';
		imgEl.style.transition = imgEl.style.transition || 'opacity 280ms ease';

		imgEl.style.opacity = '0';
		setTimeout(function() {
			var done = false;
			function finish() {
				if (done) return;
				done = true;
				requestAnimationFrame(function() { imgEl.style.opacity = '1'; });
				if (typeof cb === 'function') cb();
			}

			imgEl.onload = function() {
				imgEl.onload = null;
				finish();
			};
			imgEl.onerror = function() {
				imgEl.onerror = null;
				imgEl.style.opacity = '1';
			};

			imgEl.src = newSrc;
			if (imgEl.complete) finish();
		}, 180);
	} catch (e) {
		// no-op
	}
};

// Magnifier (hover to zoom a portion of an image).
// Attaches to "main" images on each page (including lock/reveal images).
window.initPageMagnifier = function(containerEl, opts) {
	try {
		if (!containerEl) return;
		if (containerEl.__magnifierInit) return;

		opts = opts || {};
		var zoom = typeof opts.zoom === 'number' ? opts.zoom : 2.2;
		var size = typeof opts.size === 'number' ? opts.size : 140;

		// Make sure we can absolutely-position the lens inside the page container.
		var cs = window.getComputedStyle(containerEl);
		if (cs && cs.position === 'static') containerEl.style.position = 'relative';

		// Toggle button (click to enable/disable magnifier).
		var toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'page-magnifier-toggle';
		toggle.setAttribute('aria-label', 'Toggle magnifier');
		toggle.style.position = 'absolute';
		toggle.style.top = '12px';
		toggle.style.right = '200px';
		toggle.style.width = '44px';
		toggle.style.height = '44px';
		toggle.style.border = '0';
		toggle.style.borderRadius = '12px';
		toggle.style.cursor = 'pointer';
		toggle.style.padding = '0';
		toggle.style.display = 'grid';
		toggle.style.placeItems = 'center';
		toggle.style.zIndex = '10000';
		toggle.style.background = 'transparent';
		toggle.style.backdropFilter = 'blur(6px)';
		toggle.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
		toggle.style.border = '1px solid rgba(255,255,255,0.35)';

		// Use project asset icon.
		var icon = document.createElement('img');
		icon.className = 'page-magnifier-icon';
		icon.src = 'pics/magnifier.png';
		icon.alt = '';
		icon.style.width = '26px';
		icon.style.height = '26px';
		icon.style.objectFit = 'contain';
		icon.style.filter = 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))';
		icon.style.pointerEvents = 'none';
		toggle.appendChild(icon);
		containerEl.appendChild(toggle);

		containerEl.__magnifierEnabled = false;

		var lens = document.createElement('div');
		lens.className = 'page-magnifier-lens';
		lens.style.position = 'absolute';
		lens.style.width = size + 'px';
		lens.style.height = size + 'px';
		lens.style.borderRadius = '999px';
		lens.style.border = '2px solid rgba(255,255,255,0.9)';
		// lens.style.boxShadow = '0 14px 40px rgba(0,0,0,0.35)';
		lens.style.backgroundRepeat = 'no-repeat';
		// lens.style.backgroundColor = 'rgba(0,0,0,0.12)';
		lens.style.pointerEvents = 'none';
		lens.style.display = 'none';
		lens.style.zIndex = '9999';
		containerEl.appendChild(lens);

		function setToggleState(enabled) {
			containerEl.__magnifierEnabled = !!enabled;
			if (!containerEl.__magnifierEnabled) lens.style.display = 'none';
			toggle.style.background = 'transparent';
			toggle.style.borderColor = containerEl.__magnifierEnabled ? 'rgba(37,99,235,0.9)' : 'rgba(255,255,255,0.35)';
			toggle.style.boxShadow = containerEl.__magnifierEnabled
				? '0 10px 30px rgba(37,99,235,0.25)'
				: '0 10px 30px rgba(0,0,0,0.25)';
		}

		toggle.addEventListener('click', function(e) {
			// Don't let turn.js treat this as a page click.
			stopTurnJsClick(e);
			setToggleState(!containerEl.__magnifierEnabled);
		});

		function getRenderedBox(imgRect, naturalW, naturalH) {
			var rectW = imgRect.width;
			var rectH = imgRect.height;
			if (!naturalW || !naturalH || !rectW || !rectH) return null;

			var imgAR = naturalW / naturalH;
			var boxAR = rectW / rectH;
			var renderW, renderH, offX, offY;
			if (imgAR > boxAR) {
				// constrained by width
				renderW = rectW;
				renderH = rectW / imgAR;
				offX = 0;
				offY = (rectH - renderH) / 2;
			} else {
				// constrained by height
				renderH = rectH;
				renderW = rectH * imgAR;
				offX = (rectW - renderW) / 2;
				offY = 0;
			}
			return { renderW: renderW, renderH: renderH, offX: offX, offY: offY };
		}

		function attachToImage(img) {
			if (!img || img.__magnifierAttached) return;
			// Skip UI icons/buttons; only magnify page content images.
			if (img.closest && (img.closest('button') || img.closest('.page-magnifier-toggle'))) return;

			img.__magnifierAttached = true;

			function hide() {
				lens.style.display = 'none';
			}

			function move(e) {
				if (!containerEl.__magnifierEnabled) return;
				var imgRect = img.getBoundingClientRect();
				var cRect = containerEl.getBoundingClientRect();

				var x = e.clientX - imgRect.left;
				var y = e.clientY - imgRect.top;

				// Compute actual rendered image area under object-fit: contain.
				var box = getRenderedBox(imgRect, img.naturalWidth, img.naturalHeight);
				if (!box) return hide();

				// Outside the rendered image (within letterboxed padding)
				if (x < box.offX || x > box.offX + box.renderW || y < box.offY || y > box.offY + box.renderH) {
					return hide();
				}

				// Position lens relative to container.
				var relX = e.clientX - cRect.left;
				var relY = e.clientY - cRect.top;
				lens.style.left = Math.max(0, Math.min(cRect.width - size, relX - size / 2)) + 'px';
				lens.style.top = Math.max(0, Math.min(cRect.height - size, relY - size / 2)) + 'px';

				// Background zoom relative to the rendered image box.
				var bx = x - box.offX;
				var by = y - box.offY;
				lens.style.backgroundImage = 'url("' + img.src + '")';
				lens.style.backgroundSize = (box.renderW * zoom) + 'px ' + (box.renderH * zoom) + 'px';
				lens.style.backgroundPosition =
					(-bx * zoom + size / 2) + 'px ' +
					(-by * zoom + size / 2) + 'px';

				lens.style.display = 'block';
			}

			img.addEventListener('mousemove', move);
			img.addEventListener('mouseenter', function() {
				if (containerEl.__magnifierEnabled) lens.style.display = 'block';
			});
			img.addEventListener('mouseleave', hide);
		}

		// Attach to likely "main" images.
		var imgs = containerEl.querySelectorAll('img');
		for (var i = 0; i < imgs.length; i++) attachToImage(imgs[i]);

		// Also attach to any images added later (some pages inject content dynamically).
		var mo = new MutationObserver(function(muts) {
			for (var mi = 0; mi < muts.length; mi++) {
				var m = muts[mi];
				if (!m.addedNodes) continue;
				for (var ni = 0; ni < m.addedNodes.length; ni++) {
					var node = m.addedNodes[ni];
					if (!node) continue;
					if (node.tagName === 'IMG') {
						attachToImage(node);
					} else if (node.querySelectorAll) {
						var addedImgs = node.querySelectorAll('img');
						for (var ai = 0; ai < addedImgs.length; ai++) attachToImage(addedImgs[ai]);
					}
				}
			}
		});
		mo.observe(containerEl, { childList: true, subtree: true });
		containerEl.__magnifierObserver = mo;

		// If lock/reveal swaps src later, the listeners still work (same <img> element).
		containerEl.__magnifierInit = true;
	} catch (e) {
		console.warn('[magnifier] init failed:', e);
	}
};

function stopTurnJsClick(e) {
	try {
		e.preventDefault();
		e.stopPropagation();
		if (e.stopImmediatePropagation) e.stopImmediatePropagation();
	} catch (err) {}
}

window.initPage8QA = function(containerEl) {
	try {
		if (!containerEl) return;
		if (containerEl.__page8QAInit) return;

		var box = containerEl.querySelector('.js-page8-qa');
		if (!box) return;
		var yes = box.querySelector('.js-page8-yes');
		var no = box.querySelector('.js-page8-no');
		if (!yes || !no) return;

		function onAnswer(e) {
			stopTurnJsClick(e);
			window.__page8Answered = true;
			window.__page9Revealed = true;

			yes.disabled = true;
			no.disabled = true;
			yes.style.opacity = '0.7';
			no.style.opacity = '0.7';

			// If page9 is already in DOM, reveal immediately; otherwise it will reveal on init.
			var p9 = document.querySelector('.sj-book .p9');
			if (p9) {
				var img = p9.querySelector('.js-page9-lock-img');
				if (img) window.fadeSwapImage(img, 'pics/5.png');
			}
		}

		yes.addEventListener('click', onAnswer);
		no.addEventListener('click', onAnswer);

		containerEl.__page8QAInit = true;
	} catch (e) {
		console.warn('[page8] QA init failed:', e);
	}
};

window.initPage9QA = function(containerEl) {
	try {
		if (!containerEl) return;
		if (containerEl.__page9QAInit) return;

		var img = containerEl.querySelector('.js-page9-lock-img');
		// If page8 already answered, reveal lock -> 5.png
		if ((window.__page8Answered || window.__page9Revealed) && img) {
			window.fadeSwapImage(img, 'pics/5.png');
		}

		var box = containerEl.querySelector('.js-page9-qa');
		if (!box) return;
		var yes = box.querySelector('.js-page9-yes');
		var no = box.querySelector('.js-page9-no');
		if (!yes || !no) return;

		function onAnswer(e) {
			stopTurnJsClick(e);
			window.__page9Answered = true;

			yes.disabled = true;
			no.disabled = true;
			yes.style.opacity = '0.7';
			no.style.opacity = '0.7';
		}

		yes.addEventListener('click', onAnswer);
		no.addEventListener('click', onAnswer);

		containerEl.__page9QAInit = true;
	} catch (e) {
		console.warn('[page9] QA init failed:', e);
	}
};

// Simple "locked -> revealed image" helper for static pages.
// Usage: initLockedRevealPage(containerEl, { unlockedSrc: 'pics/7.jpg' })
window.initLockedRevealPage = function(containerEl, opts) {
	try {
		if (!containerEl) return;
		if (containerEl.__lockedRevealInitialized) return;

		opts = opts || {};
		var unlockedSrc = opts.unlockedSrc;
		var onUnlock = opts.onUnlock;
		if (!unlockedSrc) return;

		var root = containerEl.querySelector('.js-locked-reveal');
		if (!root) return;

		var img = root.querySelector('.js-locked-reveal-img');
		var btn = root.querySelector('.js-locked-reveal-btn');
		if (!img || !btn) return;

		// Fade transition (can't animate src change directly).
		img.style.opacity = img.style.opacity || '1';
		img.style.transition = img.style.transition || 'opacity 280ms ease';

		btn.addEventListener('click', function(e) {
			try {
				e.preventDefault();
				e.stopPropagation();
				if (e.stopImmediatePropagation) e.stopImmediatePropagation();
			} catch (err) {}

			// Prevent double-clicks.
			btn.disabled = true;
			btn.style.pointerEvents = 'none';

			// Fade out, swap, then fade in when loaded.
			img.style.opacity = '0';
			setTimeout(function() {
				var done = false;
				function reveal() {
					if (done) return;
					done = true;
					// Fade in on next frame.
					requestAnimationFrame(function() {
						img.style.opacity = '1';
					});
					btn.style.display = 'none';
					root.classList.add('is-unlocked');
					if (typeof onUnlock === 'function') onUnlock();
				}

				img.onload = function() {
					img.onload = null;
					reveal();
				};
				img.onerror = function() {
					// If loading fails, at least restore visibility and button.
					img.onerror = null;
					img.style.opacity = '1';
					btn.disabled = false;
					btn.style.pointerEvents = '';
				};

				img.src = unlockedSrc;
				// If the image is cached and loads instantly, onload may not fire reliably.
				if (img.complete) reveal();
			}, 180);
		});

		containerEl.__lockedRevealInitialized = true;
	} catch (e) {
		console.warn('[locked-reveal] init failed:', e);
	}
};

// Page 6: particles background (Three.js)
window.initCassiePage6 = function(containerEl) {
	try {
		if (!containerEl) return;

		var root = containerEl.querySelector('#page6-root');
		var host = containerEl.querySelector('#page6-canvas-host');
		var colorInput = containerEl.querySelector('#page6-color');
		if (!root || !host || !colorInput) return;

		// Minimal status UI (inserted into existing controls panel)
		var controls = containerEl.querySelector('#page6-controls');
		var statusEl = containerEl.querySelector('#page6-gesture-status');
		if (controls && !statusEl) {
			statusEl = document.createElement('div');
			statusEl.id = 'page6-gesture-status';
			statusEl.style.marginTop = '8px';
			statusEl.style.fontSize = '11px';
			statusEl.style.opacity = '0.85';
			statusEl.textContent = 'Hand control: loading…';
			controls.appendChild(statusEl);
		}

		// Prevent double-init for the same host
		if (host.__page6Initialized) return;
		host.__page6Initialized = true;

		// Ensure Three.js is available
		cassieEnsureScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
			.then(function() {
				if (!window.THREE) throw new Error('THREE is not available after loading script');

				// Clean host
				host.innerHTML = '';

				var scene = new THREE.Scene();
				scene.fog = new THREE.FogExp2(0x000000, 0.001);

				var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
				camera.position.z = 150;

				var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
				renderer.setPixelRatio(window.devicePixelRatio || 1);
				host.appendChild(renderer.domElement);

				var uniforms = {
					uTime: { value: 0 },
					uColor: { value: new THREE.Color(colorInput.value || '#00ffff') },
					uExpansion: { value: 0.0 }
				};

				// IMPORTANT: use real newlines in GLSL (not the two-character sequence "\n")
				var vertexShader = [
					'uniform float uTime;',
					'uniform float uExpansion;',
					'attribute vec3 aRandom;',
					'varying float vAlpha;',
					'void main() {',
					'  vec3 targetPos = position;',
					'  vec3 explodedPos = targetPos + aRandom * 150.0 * uExpansion;',
					'  vec3 p = mix(targetPos, explodedPos, uExpansion);',
					'  p.x += sin(uTime * 2.0 + position.y * 0.05) * 2.0 * (1.0 - uExpansion);',
					'  p.y += cos(uTime * 1.5 + position.x * 0.05) * 2.0 * (1.0 - uExpansion);',
					'  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
					'  gl_Position = projectionMatrix * mv;',
					'  gl_PointSize = (3.0 + uExpansion * 2.0) * (300.0 / -mv.z);',
					'  vAlpha = 1.0 - uExpansion * 0.8;',
					'}'
				].join('\n');

				var fragmentShader = [
					'uniform vec3 uColor;',
					'varying float vAlpha;',
					'void main() {',
					'  float r = distance(gl_PointCoord, vec2(0.5));',
					'  if (r > 0.5) discard;',
					'  float glow = 1.0 - (r * 2.0);',
					'  glow = pow(glow, 1.5);',
					'  gl_FragColor = vec4(uColor, vAlpha * glow);',
					'}'
				].join('\n');

				var particles = null;
				function buildTextParticles(text) {
					if (particles) {
						scene.remove(particles);
						if (particles.geometry) particles.geometry.dispose();
						if (particles.material) particles.material.dispose();
						particles = null;
					}

					var c = document.createElement('canvas');
					var ctx = c.getContext('2d');
					c.width = 220;
					c.height = 220;

					ctx.fillStyle = 'black';
					ctx.fillRect(0, 0, c.width, c.height);
					ctx.fillStyle = 'white';
					ctx.font = 'bold 80px Arial';
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(text, c.width / 2, c.height / 2);

					var img = ctx.getImageData(0, 0, c.width, c.height).data;
					var positions = [];
					var randoms = [];

					for (var y = 0; y < c.height; y += 2) {
						for (var x = 0; x < c.width; x += 2) {
							var idx = (y * c.width + x) * 4;
							var v = img[idx];
							if (v > 128) {
								positions.push((x - c.width / 2) * 1.5);
								positions.push(-(y - c.height / 2) * 1.5);
								positions.push(0);
								randoms.push((Math.random() - 0.5));
								randoms.push((Math.random() - 0.5));
								randoms.push((Math.random() - 0.5));
							}
						}
					}

					var geometry = new THREE.BufferGeometry();
					geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
					geometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 3));

					var material = new THREE.ShaderMaterial({
						uniforms: uniforms,
						vertexShader: vertexShader,
						fragmentShader: fragmentShader,
						transparent: true,
						depthWrite: false,
						blending: THREE.AdditiveBlending
					});

					particles = new THREE.Points(geometry, material);
					scene.add(particles);
				}

				buildTextParticles('Hi');

				function resize() {
					var rect = root.getBoundingClientRect();
					var w = Math.max(1, Math.floor(rect.width));
					var h = Math.max(1, Math.floor(rect.height));
					renderer.setSize(w, h, false);
					camera.aspect = w / h;
					camera.updateProjectionMatrix();
				}

				// Better than polling; still keep a fallback.
				var ro = null;
				if (window.ResizeObserver) {
					ro = new ResizeObserver(function() { resize(); });
					ro.observe(root);
				}
				resize();
				var resizeTimer = setInterval(resize, 400);

				colorInput.addEventListener('input', function(e) {
					uniforms.uColor.value.set(e.target.value);
				});

				// --- Hand control (MediaPipe Hands) ---
				var targetExpansion = 0;
				var currentExpansion = 0;

				function setStatus(text) {
					if (statusEl) statusEl.textContent = text;
				}

				// Load MediaPipe scripts on demand (once)
				Promise.resolve()
					.then(function() {
						setStatus('Hand control: loading model…');
						return cassieEnsureScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
					})
					.then(function() {
						return cassieEnsureScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
					})
					.then(function() {
						if (!window.Hands || !window.Camera) {
							throw new Error('MediaPipe Hands/Camera not available');
						}

						// create hidden video (inside container so we can clean it up when page is removed)
						var video = containerEl.querySelector('#page6-hands-video');
						if (!video) {
							video = document.createElement('video');
							video.id = 'page6-hands-video';
							video.style.display = 'none';
							video.playsInline = true;
							containerEl.appendChild(video);
						}

						var hands = new Hands({
							locateFile: function(file) {
								return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file;
							}
						});

						hands.setOptions({
							maxNumHands: 1,
							modelComplexity: 1,
							minDetectionConfidence: 0.5,
							minTrackingConfidence: 0.5
						});

						hands.onResults(function(results) {
							if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
								setStatus('Hand control: tracking');
								var landmarks = results.multiHandLandmarks[0];
								var wrist = landmarks[0];
								var tips = [8, 12, 16, 20];
								var totalDist = 0;
								for (var i = 0; i < tips.length; i++) {
									var tip = landmarks[tips[i]];
									var dx = tip.x - wrist.x;
									var dy = tip.y - wrist.y;
									totalDist += Math.sqrt(dx * dx + dy * dy);
								}
								var avgDist = totalDist / 4;
								var minOpen = 0.15;
								var maxOpen = 0.45;
								var handFactor = (avgDist - minOpen) / (maxOpen - minOpen);
								handFactor = Math.max(0, Math.min(1, handFactor));
								targetExpansion = handFactor;
							} else {
								setStatus('Hand control: no hand');
								targetExpansion = 0;
							}
						});

						var cam = new Camera(video, {
							onFrame: async function() {
								await hands.send({ image: video });
							},
							width: 640,
							height: 480
						});

						setStatus('Hand control: request camera permission…');
						cam.start();

						// Store for cleanup
						host.__page6Hands = { cam: cam, hands: hands, video: video };
					})
					.catch(function(e) {
						console.warn('[page6] hand control disabled:', e);
						setStatus('Hand control: unavailable');
					});

				// Best-effort cleanup if this page node is removed
				var mo = new MutationObserver(function() {
					if (!document.body.contains(containerEl)) {
						try { if (ro) ro.disconnect(); } catch (e) {}
						clearInterval(resizeTimer);
						try {
							if (host.__page6Hands && host.__page6Hands.video) {
								// stop camera tracks if possible
								var stream = host.__page6Hands.video.srcObject;
								if (stream && stream.getTracks) {
									stream.getTracks().forEach(function(t) { try { t.stop(); } catch (e) {} });
								}
							}
						} catch (e) {}
						try { renderer.dispose(); } catch (e) {}
						try {
							if (particles && particles.geometry) particles.geometry.dispose();
							if (particles && particles.material) particles.material.dispose();
						} catch (e) {}
						mo.disconnect();
					}
				});
				mo.observe(document.body, { childList: true, subtree: true });

				// Animate loop: include hand-driven expansion smoothing
				(function animate() {
					uniforms.uTime.value += 0.05;
					currentExpansion += (targetExpansion - currentExpansion) * 0.12;
					uniforms.uExpansion.value = currentExpansion;

					if (particles) {
						var t = uniforms.uTime.value;
						particles.rotation.y = Math.sin(t * 0.3) * 0.15;
						particles.rotation.x = Math.cos(t * 0.25) * 0.08;
					}
					renderer.render(scene, camera);
					requestAnimationFrame(animate);
				})();
			})
			.catch(function(e) {
				console.error('[page6] init failed:', e);
			});
	} catch (e) {
		console.error('[page6] init exception:', e);
	}
};

function updateDepth(book, newPage) {

	var page = book.turn('page'),
		pages = book.turn('pages'),
		depthWidth = 16*Math.min(1, page*2/pages);

		newPage = newPage || page;

	if (newPage>3)
		$('.sj-book .p2 .depth').css({
			width: depthWidth,
			left: 20 - depthWidth
		});
	else
		$('.sj-book .p2 .depth').css({width: 0});

		depthWidth = 16*Math.min(1, (pages-page)*2/pages);

	if (newPage<pages-3)
		$('.sj-book .p21 .depth').css({
			width: depthWidth,
			right: 20 - depthWidth
		});
	else
		$('.sj-book .p21 .depth').css({width: 0});

}

function loadPage(page) {

	$.ajax({url: 'pages/page' + page + '.html'})
		.done(function(pageHtml) {
			// 替换旧的路径引用为正确的相对路径
			// 从 ../pics/ 或 samples/steve-jobs/pics/ 都替换为 pics/
			var processedHtml = pageHtml
				.replace(/samples\/steve-jobs\/pics\//g, 'pics/')
				.replace(/\.\.\/pics\//g, 'pics/');

			// NOTE:
			// These pages are injected via jQuery .html(). Script tags inside injected HTML
			// won't execute automatically, so interactive pages (e.g. Three.js) would not run.
			// We extract scripts, inject the HTML, then run scripts sequentially.
			var $container = $('.sj-book .p' + page);
			var $tmp = $('<div />').html(processedHtml);

			var scripts = [];
			$tmp.find('script').each(function() {
				var type = (this.getAttribute('type') || '').toLowerCase();
				// Skip module/importmap in this legacy stack
				if (type === 'module' || type === 'importmap') {
					$(this).remove();
					return;
				}
				scripts.push({
					src: this.getAttribute('src'),
					type: this.getAttribute('type') || '',
					code: this.text || this.textContent || ''
				});
				$(this).remove();
			});

			$container.html($tmp.html());

			// Run scripts in order (external first, then inline) so dependencies load correctly.
			(function runNext(i) {
				if (i >= scripts.length) return;
				var s = scripts[i];
				if (s.src) {
					// Avoid duplicating the same external script across pages
					if (window.__cassieLoadedScripts[s.src]) return runNext(i + 1);

					var el = document.createElement('script');
					el.src = s.src;
					el.async = false;
					el.onload = function() {
						window.__cassieLoadedScripts[s.src] = true;
						runNext(i + 1);
					};
					el.onerror = function() {
						console.warn('Failed to load script:', s.src);
						runNext(i + 1);
					};
					document.head.appendChild(el);
				} else {
					// Avoid eval; execute by injecting a real script tag.
					// This is more reliable across browsers when HTML is injected dynamically.
					try {
						var inline = document.createElement('script');
						if (s.type) inline.type = s.type;
						inline.text = s.code;
						// Append to container so document.getElementById() finds injected nodes.
						// (Execution is global either way, but this keeps intent clear.)
						$container[0].appendChild(inline);
						$container[0].removeChild(inline);
					} catch (e) {
						console.error('Inline script error on page ' + page + ':', e);
					}
					runNext(i + 1);
				}
			})(0);

			// Init special pages after DOM injection
			if (window.initPageMagnifier) {
				window.initPageMagnifier($container[0]);
			}
			if (page == 6 && window.initCassiePage6) {
				window.initCassiePage6($container[0]);
			}
			if (page == 8 && window.initPage8QA) {
				window.initPage8QA($container[0]);
			}
			if (page == 9 && window.initPage9QA) {
				window.initPage9QA($container[0]);
			}
			if (page == 10 && window.initLockedRevealPage) {
				window.initLockedRevealPage($container[0], { unlockedSrc: 'pics/7.jpg' });
			}
			if (page == 11 && window.initLockedRevealPage) {
				// Gate turning forward until unlocked.
				window.__page11Unlocked = window.__page11Unlocked === true ? true : false;
				window.initLockedRevealPage($container[0], {
					unlockedSrc: 'pics/8.jpg',
					onUnlock: function() { window.__page11Unlocked = true; }
				});
			}
		})
		.fail(function(xhr, status, error) {
			console.error('Failed to load page ' + page + ':', error, 'Status:', xhr.status);
			$('.sj-book .p' + page).html(
				'<div class="book-content"><p>Page ' + page + ' content</p></div>' +
				'<span class="page-number">' + page + '</span>'
			);
		});

}


function addPage(page, book) {

	var id, pages = book.turn('pages');

	if (!book.turn('hasPage', page)) {

		var element = $('<div />',
			{'class': 'own-size',
				css: {width: 460, height: 582}
			}).
			html('<div class="loader"></div>');

		if (book.turn('addPage', element, page)) {
			loadPage(page);
		}

	}
}

function numberOfViews(book) {

	return book.turn('pages') / 2 + 1;

}

function getViewNumber(book, page) {

	return parseInt((page || book.turn('page'))/2 + 1, 10);

}

function zoomHandle(e) {

	if ($('.sj-book').data().zoomIn)
		zoomOut();
	else if (e.target && $(e.target).hasClass('zoom-this')) {
		zoomThis($(e.target));
	}

}

function zoomThis(pic) {

	var	position, translate,
		tmpContainer = $('<div />', {'class': 'zoom-pic'}),
		transitionEnd = $.cssTransitionEnd(),
		tmpPic = $('<img />'),
		zCenterX = $('#book-zoom').width()/2,
		zCenterY = $('#book-zoom').height()/2,
		bookPos = $('#book-zoom').offset(),
		picPos = {
			left: pic.offset().left - bookPos.left,
			top: pic.offset().top - bookPos.top
		},
		completeTransition = function() {
			$('#book-zoom').unbind(transitionEnd);

			if ($('.sj-book').data().zoomIn) {
				tmpContainer.appendTo($('body'));

				$('body').css({'overflow': 'hidden'});
				
				tmpPic.css({
					margin: position.top + 'px ' + position.left+'px'
				}).
				appendTo(tmpContainer).
				fadeOut(0).
				fadeIn(500);
			}
		};

		$('.sj-book').data().zoomIn = true;

		$('.sj-book').turn('disable', true);

		$(window).resize(zoomOut);
		
		tmpContainer.click(zoomOut);

		tmpPic.load(function() {
			var realWidth = $(this)[0].width,
				realHeight = $(this)[0].height,
				zoomFactor = realWidth/pic.width(),
				picPosition = {
					top:  (picPos.top - zCenterY)*zoomFactor + zCenterY + bookPos.top,
					left: (picPos.left - zCenterX)*zoomFactor + zCenterX + bookPos.left
				};


			position = {
				top: ($(window).height()-realHeight)/2,
				left: ($(window).width()-realWidth)/2
			};

			translate = {
				top: position.top-picPosition.top,
				left: position.left-picPosition.left
			};

			$('.samples .bar').css({visibility: 'hidden'});
			$('#slider-bar').hide();
			
		
			$('#book-zoom').transform(
				'translate('+translate.left+'px, '+translate.top+'px)' +
				'scale('+zoomFactor+', '+zoomFactor+')');

			if (transitionEnd)
				$('#book-zoom').bind(transitionEnd, completeTransition);
			else
				setTimeout(completeTransition, 1000);

		});

		tmpPic.attr('src', pic.attr('src'));

}

function zoomOut() {

	var transitionEnd = $.cssTransitionEnd(),
		completeTransition = function(e) {
			$('#book-zoom').unbind(transitionEnd);
			$('.sj-book').turn('disable', false);
			$('body').css({'overflow': 'auto'});
			moveBar(false);
		};

	$('.sj-book').data().zoomIn = false;

	$(window).unbind('resize', zoomOut);

	moveBar(true);

	$('.zoom-pic').remove();
	$('#book-zoom').transform('scale(1, 1)');
	$('.samples .bar').css({visibility: 'visible'});
	$('#slider-bar').show();

	if (transitionEnd)
		$('#book-zoom').bind(transitionEnd, completeTransition);
	else
		setTimeout(completeTransition, 1000);
}


function moveBar(yes) {
	if (Modernizr && Modernizr.csstransforms) {
		$('#slider .ui-slider-handle').css({zIndex: yes ? -1 : 10000});
	}
}

function setPreview(view) {

	var previewWidth = 115,
		previewHeight = 73,
		previewSrc = 'pages/preview.jpg',
		preview = $(_thumbPreview.children(':first')),
		numPages = (view==1 || view==$('#slider').slider('option', 'max')) ? 1 : 2,
		width = (numPages==1) ? previewWidth/2 : previewWidth;

	_thumbPreview.
		addClass('no-transition').
		css({width: width + 15,
			height: previewHeight + 15,
			top: -previewHeight - 30,
			left: ($($('#slider').children(':first')).width() - width - 15)/2
		});

	preview.css({
		width: width,
		height: previewHeight
	});

	if (preview.css('background-image')==='' ||
		preview.css('background-image')=='none') {

		preview.css({backgroundImage: 'url(' + previewSrc + ')'});

		setTimeout(function(){
			_thumbPreview.removeClass('no-transition');
		}, 0);

	}

	preview.css({backgroundPosition:
		'0px -'+((view-1)*previewHeight)+'px'
	});
}

function isChrome() {

	// Chrome's unsolved bug
	// http://code.google.com/p/chromium/issues/detail?id=128488

	return navigator.userAgent.indexOf('Chrome')!=-1;

}
