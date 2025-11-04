/**
 * Style Kits管理API
 * 艹，这个API必须支持样式包的完整CRUD，还要能应用到编辑器！
 *
 * @author 老王
 */

import { NextRequest, NextResponse } from 'next/server';

// 模拟数据库数据
let mockStyleKits = [
  {
    id: 'kit_001',
    name: '经典品牌样式',
    code: 'CLASSIC-001',
    description: '适用于经典品牌的样式包，包含传统配色和字体',
    brand: '品牌A',
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z',
    createdBy: '设计师张三',
    colors: [
      {
        id: 'color_001',
        name: '经典红',
        hex: '#C41E3A',
        rgb: { r: 196, g: 30, b: 58 },
        usage: ['logo', 'buttons', 'highlights'],
        isPrimary: true
      },
      {
        id: 'color_002',
        name: '深蓝',
        hex: '#1E3A8A',
        rgb: { r: 30, g: 58, b: 138 },
        usage: ['headers', 'backgrounds'],
        isPrimary: false
      }
    ],
    fonts: [
      {
        id: 'font_001',
        name: '品牌主字体',
        family: 'PingFang SC',
        weights: [400, 500, 700],
        sizes: [12, 14, 16, 18, 24, 32],
        lineHeight: 1.5,
        letterSpacing: 0,
        usage: ['headings', 'body']
      }
    ],
    watermarks: [
      {
        id: 'watermark_001',
        name: '品牌Logo水印',
        type: 'logo',
        content: 'Brand Logo',
        position: 'bottom-right',
        opacity: 0.3,
        size: 80,
        rotation: 45
      }
    ],
    priceTags: [
      {
        id: 'tag_001',
        name: '经典价签',
        template: 'classic',
        fields: [
          { key: 'price', label: '价格', type: 'price', required: true },
          { key: 'currency', label: '货币', type: 'currency', required: true },
          { key: 'discount', label: '折扣', type: 'discount', required: false }
        ],
        style: {
          backgroundColor: '#FFFFFF',
          textColor: '#333333',
          borderColor: '#E5E5E5',
          borderWidth: 1,
          borderRadius: 4,
          fontSize: 14,
          fontWeight: 400,
          padding: { top: 8, right: 12, bottom: 8, left: 12 }
        }
      }
    ],
    preview: 'https://api.dicebear.com/7.x/avataaars/svg?seed=stylekit1'
  }
];

// 应用到编辑器的模拟函数
async function applyToEditor(styleKitId: string, userId?: string) {
  console.log(`Applying style kit ${styleKitId} to editor for user ${userId || 'anonymous'}`);

  // 模拟应用时间
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 这里应该调用编辑器的API来应用样式
  return {
    success: true,
    appliedAt: new Date().toISOString(),
    componentsApplied: {
      colors: 2,
      fonts: 1,
      watermarks: 1,
      priceTags: 1
    }
  };
}

// GET - 获取样式包列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');
    const brand = searchParams.get('brand');
    const status = searchParams.get('status');

    let filteredData = mockStyleKits;

    // 搜索过滤
    if (search) {
      filteredData = filteredData.filter(kit =>
        kit.name.toLowerCase().includes(search.toLowerCase()) ||
        kit.code.toLowerCase().includes(search.toLowerCase()) ||
        kit.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 品牌过滤
    if (brand) {
      filteredData = filteredData.filter(kit => kit.brand === brand);
    }

    // 状态过滤
    if (status) {
      filteredData = filteredData.filter(kit => kit.status === status);
    }

    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        total: filteredData.length,
        page,
        limit,
        totalPages: Math.ceil(filteredData.length / limit)
      },
      meta: {
        brands: [...new Set(mockStyleKits.map(kit => kit.brand))],
        statuses: [...new Set(mockStyleKits.map(kit => kit.status))]
      }
    });

  } catch (error) {
    console.error('Failed to fetch style kits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch style kits' },
      { status: 500 }
    );
  }
}

// POST - 创建新样式包
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newStyleKit = {
      id: `kit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockStyleKits.push(newStyleKit);

    console.log('Created style kit:', newStyleKit.id);

    return NextResponse.json({
      data: newStyleKit,
      message: 'Style kit created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to create style kit:', error);
    return NextResponse.json(
      { error: 'Failed to create style kit' },
      { status: 500 }
    );
  }
}

// PUT - 更新样式包
export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Style kit ID is required' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    const index = mockStyleKits.findIndex(kit => kit.id === id);
    if (index === -1) {
      return NextResponse.json(
        { error: 'Style kit not found' },
        { status: 404 }
      );
    }

    const updatedStyleKit = {
      ...mockStyleKits[index],
      ...body,
      updatedAt: new Date().toISOString()
    };

    mockStyleKits[index] = updatedStyleKit;

    console.log('Updated style kit:', id);

    return NextResponse.json({
      data: updatedStyleKit,
      message: 'Style kit updated successfully'
    });

  } catch (error) {
    console.error('Failed to update style kit:', error);
    return NextResponse.json(
      { error: 'Failed to update style kit' },
      { status: 500 }
    );
  }
}

// DELETE - 删除样式包
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Style kit ID is required' },
      { status: 400 }
    );
  }

  try {
    const index = mockStyleKits.findIndex(kit => kit.id === id);
    if (index === -1) {
      return NextResponse.json(
        { error: 'Style kit not found' },
        { status: 404 }
      );
    }

    const deletedKit = mockStyleKits[index];
    mockStyleKits.splice(index, 1);

    console.log('Deleted style kit:', id);

    return NextResponse.json({
      data: deletedKit,
      message: 'Style kit deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete style kit:', error);
    return NextResponse.json(
      { error: 'Failed to delete style kit' },
      { status: 500 }
    );
  }
}