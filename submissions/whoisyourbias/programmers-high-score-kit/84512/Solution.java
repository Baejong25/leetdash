import java.util.*;

class Solution {
    
    
    public int solution(String word) {
        int answer = 0;
        ArrayList<String> arr = new ArrayList<>();
        String[] str = {"A", "E", "I", "O", "U"};
        ArrayList<String> current = new ArrayList<>();
        
        for (int i = 1; i <= 5; i++) {
            permutation(arr, str, current, 0, i);
        }
        System.out.println(arr);
        Collections.sort(arr, new Comparator<String>() {
        	@Override
			public int compare(String a, String b) {
				if (a.length() > b.length()) {
					return -1;
				}

				return a.compareTo(b);
			}
        });

		return Collections.binarySearch(arr, word) + 1;
    }
    
    public void permutation(ArrayList<String> arr, String[] str, ArrayList<String> current, int cur, int r) {
        if (cur == r)
        {
            arr.add(String.join("", current));
            return;
        }
        
        for (int i = 0; i < str.length; i++) {
            current.add(str[i]);
            permutation(arr,str,current,cur + 1, r);
            current.removeLast();
        }
    }
    
    
}
