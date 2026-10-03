(function () {
    function setLoading(container, isLoading) {
        if (isLoading) {
            container.classList.add('is-loading');
        } else {
            container.classList.remove('is-loading');
        }
    }

    function updateStatus(container, message) {
        var status = container.querySelector('.wpcs-omr-mc-selector-status');

        if (status) {
            status.textContent = message;
        }
    }

    function submitCurrency(currency, field) {
        var container = field ? field.closest('.wpcs-omr-mc-selector') : null;

        if (!window.wpcsOmrMc || !field) {
            return;
        }

        if (container) {
            setLoading(container, true);
            updateStatus(container, window.wpcsOmrMc.reloadMessage || 'Updating prices...');
        }

        var formData = new FormData();
        formData.append('action', 'wpcs_omr_mc_switch_currency');
        formData.append('currency', currency);
        formData.append('nonce', window.wpcsOmrMc.nonce);

        field.disabled = true;

        fetch(window.wpcsOmrMc.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Currency switch failed');
                }

                return response.json();
            })
            .then(function () {
                window.location.reload();
            })
            .catch(function () {
                field.disabled = false;
                if (container) {
                    setLoading(container, false);
                    updateStatus(container, 'Unable to update currency.');
                }
            });
    }

    document.addEventListener('change', function (event) {
        if (event.target && event.target.classList.contains('wpcs-omr-mc-selector-field')) {
            submitCurrency(event.target.value, event.target);
        }
    });

    document.addEventListener('click', function (event) {
        var link = event.target.closest('.wpcs-omr-mc-menu-item--currency > a');

        if (!link || !window.wpcsOmrMc) {
            return;
        }

        var currency = new URL(link.href, window.location.origin).searchParams.get('wpcs_currency');
        if (!currency) {
            return;
        }

        event.preventDefault();

        var formData = new FormData();
        formData.append('action', 'wpcs_omr_mc_switch_currency');
        formData.append('currency', currency);
        formData.append('nonce', window.wpcsOmrMc.nonce);

        fetch(window.wpcsOmrMc.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Currency switch failed');
                }

                return response.json();
            })
            .then(function () {
                window.location.reload();
            })
            .catch(function () {
                window.location.href = link.href;
            });
    });
}());
