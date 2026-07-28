import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.LinkedList;
import java.util.Map.Entry;

class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
		// LinkedList<List<String>> rtn = new LinkedList<>();

		HashMap<String, LinkedList<String>> m = new HashMap<>();

		for (String s : strs) {
			// String key = Arrays.toString(s.chars().sorted().toArray());
		
			char[] ch = s.toCharArray();
			Arrays.sort(ch);
			// String key = Arrays.toString(ch);
			String key= new String(ch);
			if (m.containsKey(key) == false) {
				m.put(key, new LinkedList<>());
			}

			m.get(key).add(s);
		}

		// for (Entry<String, LinkedList<String>> e: m.entrySet()) {
		// 	rtn.add(e.getValue());
		// }
		return new ArrayList<>(m.values());
		// return rtn;
    }
}
