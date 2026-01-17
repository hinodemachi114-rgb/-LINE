document.addEventListener('DOMContentLoaded', () => {
    // Preview Elements
    const previewTitle = document.getElementById('preview-title');
    const previewDesc = document.getElementById('preview-desc');
    const previewDetailBtn = document.getElementById('preview-detail-btn');
    const previewApplyBtn = document.getElementById('preview-apply-btn');
    const previewImage = document.getElementById('preview-image-display');

    // Input Elements
    const titleInput = document.getElementById('msg-title');
    const descInput = document.getElementById('msg-desc');
    const detailLinkInput = document.getElementById('msg-detail-link');
    const applyLinkInput = document.getElementById('msg-apply-link');
    const imageInput = document.getElementById('msg-image');

    // Tag Selection Logic
    const tagRadios = document.getElementsByName('target');
    const tagSelector = document.getElementById('tag-selector');

    if(tagRadios.length > 0) {
        tagRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if(e.target.value === 'segment') {
                    tagSelector.style.display = 'block';
                } else {
                    tagSelector.style.display = 'none';
                }
            });
        });
    }

    // Real-time Preview Updaters
    if(titleInput) {
        titleInput.addEventListener('input', (e) => {
            previewTitle.textContent = e.target.value || '研修会の案内';
        });
    }

    if(descInput) {
        descInput.addEventListener('input', (e) => {
            previewDesc.textContent = e.target.value || 'ここに研修会の詳細が入ります。日次や場所などの重要な情報を記載してください。';
        });
    }

    // Image Preview
    if(imageInput) {
        imageInput.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImage.src = e.target.result;
                    previewImage.style.display = 'block';
                }
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
});
