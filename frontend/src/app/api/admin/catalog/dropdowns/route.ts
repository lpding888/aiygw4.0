/**
 * Catalog联动查询API - 为工具页面提供下拉数据
 * 艹，这个API必须高效，支持按类型查询和联动查询！
 *
 * @author 老王
 */

import { NextRequest, NextResponse } from 'next/server';

// 模拟数据
const mockStyles = [
  { id: 'style_001', name: '经典T恤', code: 'TSH-001', category: '上装' },
  { id: 'style_002', name: '牛仔裤', code: 'JEA-001', category: '下装' },
  { id: 'style_003', name: '连帽衫', code: 'HOO-001', category: '外套' },
  { id: 'style_004', name: '运动裤', code: 'SPO-001', category: '下装' },
  { id: 'style_005', name: '衬衫', code: 'SHI-001', category: '上装' }
];

const mockColorways = [
  {
    id: 'color_001',
    name: '海军蓝',
    code: 'NV-001',
    primaryColor: '#000080',
    materials: ['纯棉', '氨纶'],
    status: 'active'
  },
  {
    id: 'color_002',
    name: '米白色',
    code: 'MW-001',
    primaryColor: '#F5F5DC',
    materials: ['纯棉'],
    status: 'active'
  },
  {
    id: 'color_003',
    name: '炭黑色',
    code: 'BK-001',
    primaryColor: '#36454F',
    materials: ['涤纶', '氨纶'],
    status: 'active'
  },
  {
    id: 'color_004',
    name: '酒红色',
    code: 'RD-001',
    primaryColor: '#722F37',
    materials: ['纯棉'],
    status: 'active'
  },
  {
    id: 'color_005',
    name: '军绿色',
    code: 'GN-001',
    primaryColor: '#4B5320',
    materials: ['棉麻混纺'],
    status: 'active'
  }
];

const mockSizes = [
  {
    id: 'size_001',
    name: 'XS',
    code: 'XS-001',
    category: '上装',
    fit: '修身',
    measurements: { chest: 88, waist: 72, hips: 88, length: 64 }
  },
  {
    id: 'size_002',
    name: 'S',
    code: 'S-001',
    category: '上装',
    fit: '修身',
    measurements: { chest: 96, waist: 80, hips: 96, length: 66 }
  },
  {
    id: 'size_003',
    name: 'M',
    code: 'M-001',
    category: '上装',
    fit: '修身',
    measurements: { chest: 100, waist: 84, hips: 100, length: 68 }
  },
  {
    id: 'size_004',
    name: 'L',
    code: 'L-001',
    category: '上装',
    fit: '修身',
    measurements: { chest: 108, waist: 92, hips: 108, length: 70 }
  },
  {
    id: 'size_005',
    name: 'XL',
    code: 'XL-001',
    category: '上装',
    fit: '修身',
    measurements: { chest: 116, waist: 100, hips: 116, length: 72 }
  },
  {
    id: 'size_006',
    name: '28',
    code: 'P28-001',
    category: '下装',
    fit: '标准',
    measurements: { waist: 71, hips: 96, length: 101 }
  },
  {
    id: 'size_007',
    name: '30',
    code: 'P30-001',
    category: '下装',
    fit: '标准',
    measurements: { waist: 76, hips: 101, length: 102 }
  },
  {
    id: 'size_008',
    name: '32',
    code: 'P32-001',
    category: '下装',
    fit: '标准',
    measurements: { waist: 81, hips: 106, length: 103 }
  }
];

const mockFabrics = [
  {
    id: 'fabric_001',
    name: '纯棉针织',
    code: 'COT-KN-001',
    type: '针织',
    composition: '100%纯棉',
    weight: 180,
    properties: ['透气', '柔软', '吸湿'],
    status: 'active'
  },
  {
    id: 'fabric_002',
    name: '弹力牛仔',
    code: 'DEN-ELA-001',
    type: '梭织',
    composition: '98%棉 2%氨纶',
    weight: 320,
    properties: ['弹力', '耐磨', '挺括'],
    status: 'active'
  },
  {
    id: 'fabric_003',
    name: '羊毛混纺',
    code: 'WOO-MIX-001',
    type: '针织',
    composition: '70%羊毛 30%尼龙',
    weight: 280,
    properties: ['保暖', '柔软', '抗皱'],
    status: 'active'
  },
  {
    id: 'fabric_004',
    name: '亚麻布',
    code: 'LIN-001',
    type: '梭织',
    composition: '100%亚麻',
    weight: 160,
    properties: ['透气', '吸湿', '天然'],
    status: 'active'
  },
  {
    id: 'fabric_005',
    name: '聚酯纤维',
    code: 'POL-001',
    type: '梭织',
    composition: '100%聚酯纤维',
    weight: 150,
    properties: ['快干', '耐磨', '抗皱'],
    status: 'active'
  }
];

const mockArtworks = [
  {
    id: 'art_001',
    name: '品牌Logo',
    code: 'LOGO-001',
    type: 'logo',
    category: '品牌标识',
    usage: ['胸贴', '领标', '洗水标'],
    status: 'active'
  },
  {
    id: 'art_002',
    name: '印花图案',
    code: 'PRI-001',
    type: 'graphic',
    category: '装饰图案',
    usage: ['胸贴', '背部'],
    status: 'active'
  },
  {
    id: 'art_003',
    name: '条纹图案',
    code: 'STR-001',
    type: 'pattern',
    category: '基础图案',
    usage: ['全身', '袖子', '领口'],
    status: 'active'
  },
  {
    id: 'art_004',
    name: '文字标语',
    code: 'TXT-001',
    type: 'text',
    category: '文字元素',
    usage: ['胸贴', '袖子'],
    status: 'active'
  }
];

// GET - 获取下拉数据
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const types = searchParams.get('types')?.split(',') || [];
  const category = searchParams.get('category');
  const status = searchParams.get('status') || 'active';
  const format = searchParams.get('format') || 'select';

  try {
    const result: any = {};

    // 如果没有指定类型，返回所有类型
    const requestedTypes = types.length > 0 ? types : ['styles', 'colorways', 'sizes', 'fabrics', 'artworks'];

    // 获取款式数据
    if (requestedTypes.includes('styles')) {
      let stylesData = mockStyles;

      if (category) {
        stylesData = stylesData.filter(style => style.category === category);
      }

      result.styles = format === 'select'
        ? stylesData.map(style => ({
            value: style.id,
            label: `${style.name} (${style.code})`,
            ...style
          }))
        : stylesData;
    }

    // 获取颜色数据
    if (requestedTypes.includes('colorways')) {
      let colorwaysData = mockColorways.filter(color => color.status === status);

      result.colorways = format === 'select'
        ? colorwaysData.map(color => ({
            value: color.id,
            label: `${color.name} - ${color.primaryColor}`,
            color: color.primaryColor,
            ...color
          }))
        : colorwaysData;
    }

    // 获取尺码数据
    if (requestedTypes.includes('sizes')) {
      let sizesData = mockSizes;

      if (category) {
        sizesData = sizesData.filter(size => size.category === category);
      }

      result.sizes = format === 'select'
        ? sizesData.map(size => ({
            value: size.id,
            label: `${size.name} (${size.fit})`,
            ...size
          }))
        : sizesData;
    }

    // 获取面料数据
    if (requestedTypes.includes('fabrics')) {
      let fabricsData = mockFabrics.filter(fabric => fabric.status === status);

      result.fabrics = format === 'select'
        ? fabricsData.map(fabric => ({
            value: fabric.id,
            label: `${fabric.name} (${fabric.composition})`,
            ...fabric
          }))
        : fabricsData;
    }

    // 获取图案数据
    if (requestedTypes.includes('artworks')) {
      let artworksData = mockArtworks.filter(artwork => artwork.status === status);

      result.artworks = format === 'select'
        ? artworksData.map(artwork => ({
            value: artwork.id,
            label: `${artwork.name} (${artwork.type})`,
            ...artwork
          }))
        : artworksData;
    }

    // 添加分类统计
    if (searchParams.get('includeStats') === 'true') {
      result.stats = {
        styles: {
          total: mockStyles.length,
          categories: [...new Set(mockStyles.map(s => s.category))]
        },
        colorways: {
          total: mockColorways.filter(c => c.status === 'active').length,
          materials: [...new Set(mockColorways.flatMap(c => c.materials))]
        },
        sizes: {
          total: mockSizes.length,
          categories: [...new Set(mockSizes.map(s => s.category))],
          fits: [...new Set(mockSizes.map(s => s.fit))]
        },
        fabrics: {
          total: mockFabrics.filter(f => f.status === 'active').length,
          types: [...new Set(mockFabrics.map(f => f.type))]
        },
        artworks: {
          total: mockArtworks.filter(a => a.status === 'active').length,
          types: [...new Set(mockArtworks.map(a => a.type))]
        }
      };
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        types: requestedTypes,
        filters: {
          category,
          status,
          format
        }
      }
    });

  } catch (error) {
    console.error('Failed to fetch dropdown data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dropdown data' },
      { status: 500 }
    );
  }
}