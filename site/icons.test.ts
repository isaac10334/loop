import {expect,test} from 'bun:test';
import {icon,type IconName} from './icons';
test('semantic icons share a swappable decorative SVG contract',()=>{
  for(const name of ['browser','desktop','terminal','check','experiment','roadmap','shield','unknown','book','copy','search','code','agent','gamepad'] as IconName[]){
    const svg=icon(name);expect(svg).toContain(`data-icon="${name}"`);expect(svg).toContain('aria-hidden="true"');expect(svg).toContain('focusable="false"');expect(svg).not.toContain('<script');
  }
});
test('meaningful icon labels and class attributes are escaped',()=>{
  const svg=icon('book',{label:'Read "<docs>"',className:'sample" onload="bad'});
  expect(svg).toContain('role="img"');expect(svg).toContain('aria-label="Read &quot;&lt;docs&gt;&quot;"');expect(svg).toContain('sample&quot; onload=&quot;bad');expect(svg).not.toContain('aria-hidden="true"');
});
