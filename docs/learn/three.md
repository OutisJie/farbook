# React-Three-fiber问题记录

## React中修改BufferGeometry，设置`needsUpdate=true`，画面更新但无法交互

有如下代码，组件 **RPolygon** ，接收 `Point:number[]` 的数组，绘制出一个多边形

```tsx
export const RPolygon: React.FC<Props> = (points: number[][]) => {
  const [center, setCenter] = React.useState<Vector3>(new Vector3());
  const [geometry, setGeometry] = React.useState<BufferGeometry>(new BufferGeometry());

  handleClick = () => {
    console.log("click");
  }

  return (
    <React.Fragment>
      <mesh position={center} onClick={handleClick}>
        <primitive object={geometry} attach="geometry" />
        // <primitive object={material} attach="material" />
      </mesh>
    </React.Fragment>
  );
},

```

现在，我们希望当入参中的 **points** 数组发生更改的时候，更新 **center** 和 **geometry**，我们加入下面的代码：

```tsx
React.useEffect(() => {
  if (points) {
    const { center: c, positionAttribute } = doSomeThing(points) // 函数接收新的points，做一些运算，算出新的center和attribute
    positionAttribute.needsUpdate = true;
    geometry.setAttribute("position", positionAttribute);
    geometry.computeBoundingBox();
    setCenter(c);
}, [points]);

```

效果：经测试，第一次传入 **Points** 时，画面正常渲染，且能正常交互。但当 **Points** 更新时，画面中 **RPolygon** 能够正确的重新渲染，但当我们点击多边形时，出现了无法触发 **onClick** 事件的异常情况。

### useUpdate 不管用

我们将 **useEffect** 换成 react-three-fiber 提供的 **useUpdate** 试一试

```tsx
const geometryRef = useUpdate(
  (g) => {
    if (points) {
    // 函数接收新的points，做一些运算，算出新的center和attribute
    const { positionAttribute } = doSomeThing(points) 
    positionAttribute.needsUpdate = true;
    g.setAttribute("position", positionAttribute);
    g.computeBoundingBox();
  },
  [points] // execute only if these properties change
)
return (
  <React.Fragment>
    <mesh position={center} onClick={handleClick}>
      <primitive ref={geometryRef} object={geometry} attach="geometry" />
      // <primitive object={material} attach="material" />
    </mesh>
  </React.Fragment>
);

```

效果：和useEffect一样，还是有问题。

### 现有解决方案

更改useEffect中的代码如下：

```tsx
React.useEffect(() => {
  if (points) {
    const { positionAttribute } = doSomeThing(points) 
    positionAttribute.needsUpdate = true;
    const newG = new BufferGeometry();
    newG.setAttribute("position", positionAttribute);
    newG.computeBoundingBox();
    setGeometry(newG); // 更新geometry
    setCenter(c);
  }
}, [points]);

```

### 原因

其实，前面两种方案下，我们都是通过`geometry.setAttribute("position", positionAttribute)` 的方式来更新 **geometry** ，虽然 **geometry** 所指向的数据发生了改变，但是 **geometry** 本身作为一个引用，是没有变的，所以对于 **React** 而言，它也会以为 **geometry** 没有变，所以并不会触发重新 render。

但是画面为什么会重新渲染呢，因为我们做了 `setCenter` ，这个操作会触发组件的重新render，render时，会取 **geometry** 的引用所指向的数据，而 **geometry** 所指向的数据已经发生了改变，所以我们能看到画面中绘制了一个新的多边形。

但是为什么新的多边形不能正确交互呢，这个暂时还不知道。

### 更好的方案

现有的方案会将多边形的 **geometry** 整个替换掉，而不是在原有的基础上更新，对于Three而言，直接变更 **geometry** 是一个非常消耗性能的操作。

待更新...
