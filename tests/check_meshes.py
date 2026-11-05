"""Prüft exportierte Dateien: python3 tests/check_meshes.py <ordner>
STL (in ZIPs) und 3MF müssen aus geschlossenen, richtig orientierten Körpern bestehen."""
import collections, glob, os, struct, sys, zipfile
import xml.etree.ElementTree as ET

def closed(tris):
    edges = collections.Counter()
    vol = 0.0
    for a, b, c in tris:
        for p, q in ((a, b), (b, c), (c, a)):
            edges[(p, q)] += 1
        vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
    open_edges = sum(1 for (p, q), k in edges.items() if edges.get((q, p), 0) != k)
    return open_edges, vol

def stl_tris(data):
    n = struct.unpack('<I', data[80:84])[0]
    assert len(data) == 84 + n * 50, 'STL-Länge passt nicht'
    out = []
    for i in range(n):
        f = struct.unpack('<12f', data[84 + i * 50:132 + i * 50])
        out.append(tuple(tuple(round(v, 3) for v in f[3 + 3 * k:6 + 3 * k]) for k in range(3)))
    return out

def main(folder):
    bad = total = 0
    for path in sorted(glob.glob(os.path.join(folder, '*.zip'))):
        z = zipfile.ZipFile(path)
        assert z.testzip() is None, path
        for name in z.namelist():
            if not name.endswith('.stl'):
                continue
            total += 1
            oe, vol = closed(stl_tris(z.read(name)))
            if oe or vol <= 0:
                bad += 1
                print('OFFEN', os.path.basename(path), name, oe, round(vol))
    for path in sorted(glob.glob(os.path.join(folder, '*.3mf'))):
        z = zipfile.ZipFile(path)
        assert z.testzip() is None, path
        root = ET.fromstring(z.read('3D/3dmodel.model'))
        ns = {'m': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
        objs = root.findall('.//m:object', ns)
        items = root.findall('.//m:build/m:item', ns)
        for o in objs:
            total += 1
            V = [(round(float(v.get('x')), 3), round(float(v.get('y')), 3), round(float(v.get('z')), 3)) for v in o.findall('.//m:vertex', ns)]
            T = [(V[int(t.get('v1'))], V[int(t.get('v2'))], V[int(t.get('v3'))]) for t in o.findall('.//m:triangle', ns)]
            oe, vol = closed(T)
            if oe or vol <= 0:
                bad += 1
                print('OFFEN', os.path.basename(path), o.get('name'), oe, round(vol))
        print(f'{os.path.basename(path)}: {len(objs)} Objekte, {len(items)} platzierte Teile')
    print(f'{total} Körper geprüft, {bad} fehlerhaft')
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
