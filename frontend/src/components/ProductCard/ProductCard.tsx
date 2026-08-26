import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  onAddToCartClick: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCartClick }: ProductCardProps) {
  // Mostrar apenas os 5 primeiros tamanhos e o contador restante (+N)
  const visibleSizes = product.sizes.slice(0, 5);
  const remainingCount = product.sizes.length - visibleSizes.length;

  // Categorias: mostrar no máximo 2, com indicador +N para o restante
  const visibleCategories = product.categories.slice(0, 2);
  const remainingCategories = product.categories.length - visibleCategories.length;

  return (
    <div className="product-card">
      <Link to={`/produto/${product.id}`} className="product-image-wrapper">
        <img src={product.image} alt={product.name} className="product-card-image" />
      </Link>
      
      <div className="product-card-info">
        <div className="product-card-categories-tags">
          {visibleCategories.map(cat => (
            <span key={cat} className="product-card-category">{cat}</span>
          ))}
          {remainingCategories > 0 && (
            <span className="product-card-category category-remaining">+{remainingCategories}</span>
          )}
        </div>

        <span className="product-card-brand">{product.brand}</span>
        <h4 className="product-card-title">{product.name}</h4>
        
        <div className="product-card-specs">
          {product.weight} • Drop {product.drop}
        </div>

        <div className="product-card-sizes">
          {visibleSizes.map(size => (
            <span key={size} className="size-badge-mini">{size}</span>
          ))}
          {remainingCount > 0 && (
            <span className="size-badge-mini remaining">+{remainingCount}</span>
          )}
        </div>

        <div className="product-card-price-row">
          <span className="product-card-price">
            {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        
        <div className="product-card-actions-row">
          <Link to={`/produto/${product.id}`} className="card-btn-details">
            DETALHES
          </Link>
          <button 
            type="button" 
            onClick={() => onAddToCartClick(product)} 
            className="card-btn-add"
          >
            + ADICIONAR
          </button>
        </div>
      </div>
    </div>
  );
}

